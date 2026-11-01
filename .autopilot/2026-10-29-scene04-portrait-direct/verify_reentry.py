from pathlib import Path
from PIL import Image, ImageChops, ImageStat
p=Path('docs/verification/scene04-portrait-direct/after');a=Image.open(p/'t8.png').convert('RGB')
for n in ['reverse-seek-t8.png','reenter-t8.png']:
    b=Image.open(p/n).convert('RGB');d=ImageChops.difference(a.crop((280,80,760,600)),b.crop((280,80,760,600)));print(n,{'roi':[280,80,760,600],'max_delta':max(v[1] for v in d.getextrema()),'mean_delta':ImageStat.Stat(d).mean})
