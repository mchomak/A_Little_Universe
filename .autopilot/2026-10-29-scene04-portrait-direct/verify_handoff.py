from PIL import Image,ImageChops,ImageStat
from pathlib import Path
p=Path('docs/verification/scene04-portrait-direct/after');a=Image.open(p/'t21.png').convert('RGB');b=Image.open(p/'gallery-entry.png').convert('RGB');d=ImageChops.difference(a.crop((321,137,702,518)),b.crop((321,137,702,518)));print({'photo_roi':[321,137,702,518],'max_delta':max(v[1] for v in d.getextrema()),'mean_delta':ImageStat.Stat(d).mean})
