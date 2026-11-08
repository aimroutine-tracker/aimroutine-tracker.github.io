#!/usr/bin/env python3
"""Structural and pixel comparison against the owner's four exact reference frames.
Source reference images were losslessly encoded as WebP. No user results invented.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'visual-out'
REF=ROOT/'tests/references'
ROUTES={'index':'home','training':'training','account':'account','progress':'progress'}
assert OUT.is_dir(),'Screenshots not captured'
metrics={}
for route,name in ROUTES.items():
 ref=Image.open(REF/f'{name}.webp').convert('RGB')
 before=Image.open(OUT/f'{route}_before.png').convert('RGB')
 after=Image.open(OUT/f'{route}_after.png').convert('RGB')
 assert ref.size==before.size==after.size==(1672,941),(route,ref.size,before.size,after.size)
 # Difference reported over all RGB channels and all pixels, no cropping.
 def calculate(a):
  diff=ImageChops.difference(ref,a)
  hist=diff.histogram(); total=sum(n*(i%256) for i,n in enumerate(hist))
  mae=total/(1672*941*3)
  heat=diff.convert('L').point(lambda v:255 if v>30 else 0)
  changed=sum(heat.histogram()[1:])/(1672*941)*100
  return round(mae,3),round(changed,2),diff
 b_mae,b_pct,b_diff=calculate(before)
 a_mae,a_pct,a_diff=calculate(after)
 metrics[route]={'reference':'tests/references/'+name+'.webp',
  'resolution':'1672x941','before_mae':b_mae,'after_mae':a_mae,
  'before_diff_pct':b_pct,'after_diff_pct':a_pct,
  'mae_improvement':round(b_mae-a_mae,3),'pixel_perfect':a_mae==0}
 # Make a real 3-panel comparison: the original, the current live-version
 # baseline, and the new preview, all at exact dimensions.
 panel=Image.new('RGB',(1672*3,941));panel.paste(ref,(0,0));panel.paste(before,(1672,0));panel.paste(after,(3344,0))
 panel.save(OUT/f'compare_{route}_reference_before_after.jpg',quality=92)
 simple=Image.new('RGB',(1672*2,941));simple.paste(before,(0,0));simple.paste(after,(1672,0));simple.save(OUT/f'compare_{route}_before_after.jpg',quality=92)
 ImageEnhance.Contrast(a_diff).enhance(1.7).save(OUT/f'diff_{route}.png')
 print(f'{route}: before MAE={b_mae}, after MAE={a_mae}, change={round(b_mae-a_mae,3)}')
(OUT/'comparison_report.json').write_text(json.dumps(metrics,indent=2,ensure_ascii=False))
print('All four comparisons produced. An MAE of zero is the only literal pixel-perfect result.')
