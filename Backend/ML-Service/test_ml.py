import sys
sys.path.append('.')
from app.services.disruption_service import build_disruption_array
import traceback
try:
    print(build_disruption_array(12.9716, 77.5946, '2026-03-18', '560001'))
except Exception as e:
    traceback.print_exc()
