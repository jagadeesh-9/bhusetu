import sys
sys.path.insert(0, '.')
from backend.app.services.reference_dataset_service import ReferenceDatasetService

svc = ReferenceDatasetService()
print('Total buildings loaded:', svc.get_building_count())
res = svc.search_nearby(17.447400, 78.376200, radius_m=500.0)
print('Found within 500m:', len(res))
for r in res[:5]:
    print(' ', r['distanceMeters'], 'm |', r['name'], '| OSM:', r['osmId'], '| Ground_Z:', r['groundElevationM'], 'm | Levels:', r['levels'])
