import pika
import json
import threading
import logging
from ..services.redis_service import redis_client
from ..services.disruption_service import build_disruption_array

logger = logging.getLogger(__name__)


def _print_disruption_summary(source: str, user_id: str, date: str, data: dict):
    """Prints a clear, readable disruption summary to the terminal using ASCII."""
    disruptions = data.get("disruptions", [])
    weather = data.get("disruptionsByType", {}).get("weather", [])
    social = data.get("disruptionsByType", {}).get("social", [])
    zone = data.get("zone", "Unknown")

    print("\n" + "=" * 60)
    print(f"  [ML SERVICE]  [{source}]")
    print("=" * 60)
    print(f"  User     : {user_id}")
    print(f"  Date     : {date}")
    print(f"  Zone     : {zone}")
    print(f"  Coords   : {data.get('lat')}, {data.get('lng')}")
    print("-" * 60)

    if not disruptions:
        print("  [OK] No disruptions detected for this location/date.")
    else:
        print(f"  [WARNING] {len(disruptions)} disruption(s) found:\n")
        for i, d in enumerate(disruptions, 1):
            dtype = d.get("type", "?").upper()
            level = d.get("level", "?").upper()
            window = d.get("time", "?")
            print(f"  {i}. [{dtype}] Level: {level:<8}  Window: {window}")

        print()
        if weather:
            print(f"  Weather events : {len(weather)}")
        if social:
            print(f"  Social events  : {len(social)}")

    print("=" * 60 + "\n")


def callback(ch, method, properties, body):
    try:
        data = json.loads(body)
        pincode = data.get("pincode")
        lat = data.get("lat")
        lng = data.get("lng")
        date = data.get("date")
        user_id = data.get("userId", "unknown")

        if pincode is None or lat is None or lng is None or date is None:
            logger.error(f"Missing required fields. Received: {data}")
            return

        redis_key = f"disruptions:{date}:{lat}_{lng}"
        cached = redis_client.get(redis_key)

        if cached:
            print("\n" + "-" * 60)
            print(f"  [REDIS CACHE HIT]  ->  key: {redis_key}")
            print("-" * 60)

            _print_disruption_summary(
                "SERVED FROM REDIS CACHE", user_id, date, cached
            )

            try:
                ch.queue_declare(queue='ml.disruptions.processed', durable=True)
                downstream_payload = {
                    "userId": user_id,
                    "email": data.get("extraData", {}).get("email"),
                    "results": cached
                }
                ch.basic_publish(
                    exchange='',
                    routing_key='ml.disruptions.processed',
                    body=json.dumps(downstream_payload),
                    properties=pika.BasicProperties(delivery_mode=2)
                )
                logger.info("Cached result re-published")
            except Exception as pub_err:
                logger.error(f"Publish failed (cache): {pub_err}")
            return

        print("\n" + "-" * 60)
        print(f"  [FRESH ML CALCULATION]  ->  key: {redis_key}")
        print("-" * 60)

        disruptions_data = build_disruption_array(
            lat=lat,
            lng=lng,
            date=date,
            pincode=pincode
        )

        redis_client.set(redis_key, disruptions_data, ttl=1800)

        _print_disruption_summary(
            "FRESHLY COMPUTED + CACHED", user_id, date, disruptions_data
        )

        try:
            ch.queue_declare(queue='ml.disruptions.processed', durable=True)
            downstream_payload = {
                "userId": user_id,
                "email": data.get("extraData", {}).get("email"),
                "results": disruptions_data
            }
            ch.basic_publish(
                exchange='',
                routing_key='ml.disruptions.processed',
                body=json.dumps(downstream_payload),
                properties=pika.BasicProperties(delivery_mode=2)
            )
            logger.info("Successfully pushed disruptions")
        except Exception as pub_err:
            logger.error(f"Publish failed: {pub_err}")

    except Exception as e:
        logger.error(f"Error processing message: {e}")


def start_consuming():
    import os
    import time
    url = os.getenv("RABBITMQ_URL", "amqp://localhost:5672")
    parameters = pika.URLParameters(url)
    
    while True:
        try:
            logger.info("Attempting to connect to RabbitMQ from ML Service...")
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()

            channel.queue_declare(queue='location.update', durable=True)
            channel.basic_consume(
                queue='location.update',
                on_message_callback=callback,
                auto_ack=True
            )

            logger.info("Started RabbitMQ consumer in ML Service")
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError as e:
            logger.warning(f"RabbitMQ connection error in ML Service: {e}. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            logger.error(f"Consumer error in ML Service: {e}. Retrying in 5 seconds...")
            time.sleep(5)


def run_consumer_in_background():
    thread = threading.Thread(target=start_consuming, daemon=True)
    thread.start()