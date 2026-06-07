def format_time_window(start_hour, end_hour):
    start = f"{str(start_hour).zfill(2)}:00"
    end = f"{str(end_hour).zfill(2)}:00"
    return f"{start}-{end}"
