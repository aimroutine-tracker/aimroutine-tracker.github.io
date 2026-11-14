#!/usr/bin/env python3
"""Visual evidence; before/after is NOT the same as source-reference fidelity.
Optional exact source files: tests/visual-references/{home,routines,progress,account}.png.
No fabricated reference or test pass if source files are absent.
"""
from PIL import Image, ImageChops, ImageEnhance
from pathlib import Path
import json
import hashlib

root=Path('visual-results')
source=Path('tests/visual-references')
manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
assert manifest['viewport']=={'width':1672,'height':941}
pages=('home','routines','progress','account')
records=[]
for name in pages:
    with Image.open(root/f'{name}-before.png') as a, Image.open(root/f'{name}-after.png') as b:
        before=a.convert('RGB')
        after=b.convert('RGB')
        if before.size!=after.size:
            raise RuntimeError(f'Viewport mismatch: {name}: {before.size} vs {after.size}')
        delta=ImageChops.difference(before,after)
        delta=ImageEnhance.Contrast(delta).enhance(3)
        delta.save(root/f'{name}-change-diff.png',optimize=True)
        Image.blend(before,after,.5).save(root/f'{name}-before-after-overlay.png',optimize=True)
        record={'page':name,'viewport':list(after.size),
                'before_after':'captures + diff + overlay produced',
                'comparison_to_owner_reference':'NOT EXECUTED: exact reference not in repository'}
        image=source/f'{name}.png'
        if image.is_file():
            expected=manifest['references'][name]['sha256']
            actual=hashlib.sha256(image.read_bytes()).hexdigest()
            if actual!=expected:
                raise SystemExit(f'Wrong original source PNG for {name}; SHA-256 mismatch')
            record['original_sha256_verified']=True
            with Image.open(image) as im:
                ref=im.convert('RGB')
                if ref.size!=after.size:
                    raise SystemExit(f'Wrong reference dimensions for {name}: {ref.size}, expected {after.size}')
                else:
                    def mae(diff):
                        histogram=diff.histogram()
                        return sum((v%256)*count for v,count in enumerate(histogram))/(after.width*after.height*3)
                    before_diff=ImageChops.difference(ref,before)
                    ref_diff=ImageChops.difference(ref,after)
                    before_diff.save(root/f'{name}-source-before-diff.png',optimize=True)
                    Image.blend(ref,before,.5).save(root/f'{name}-source-before-overlay.png',optimize=True)
                    ref_diff.save(root/f'{name}-source-diff.png',optimize=True)
                    Image.blend(ref,after,.5).save(root/f'{name}-source-overlay.png',optimize=True)
                    old_mae=mae(before_diff)
                    new_mae=mae(ref_diff)
                    record['reference_before_mae_0_to_255']=round(old_mae,3)
                    record['reference_mae_0_to_255']=round(new_mae,3)
                    record['reference_absolute_error_reduction']=round(old_mae-new_mae,3)
                    record['reference_relative_error_reduction_percent']=round((1-new_mae/old_mae)*100,2) if old_mae else 0
                    record['source_visual_regressed']=new_mae>old_mae+0.25
                    # Track the right-hand hero image separately. A genuine
                    # artwork alignment can improve dramatically while other
                    # dynamic page sections legitimately remain different.
                    # These coordinates come from the owner's 1672x941 PNGs,
                    # never from synthetic reference art or user metrics.
                    hero_bounds={
                        'home':(780,55,1672,355),
                        'routines':(780,55,1672,300),
                        'progress':(780,55,1672,260),
                        'account':(780,55,1672,300),
                    }[name]
                    def cropped_mae(first,second,bounds):
                        a=first.crop(bounds)
                        b=second.crop(bounds)
                        differences=ImageChops.difference(a,b).histogram()
                        return sum((v%256)*count for v,count in enumerate(differences))/(a.width*a.height*3)
                    hero_before=cropped_mae(ref,before,hero_bounds)
                    hero_after=cropped_mae(ref,after,hero_bounds)
                    record['source_hero_art_bounds']=list(hero_bounds)
                    record['source_hero_art_before_mae_0_to_255']=round(hero_before,3)
                    record['source_hero_art_mae_0_to_255']=round(hero_after,3)
                    record['source_hero_art_regressed']=hero_after>hero_before+0.25
                    record['source_region_mae']={}
                    for label, y0, y1 in (('header',0,55),('hero',55,300),('mid',300,650),('lower',650,941)):
                        h=ImageChops.difference(ref.crop((0,y0,ref.width,y1)),
                                               after.crop((0,y0,after.width,y1))).histogram()
                        value=sum((v%256)*count for v,count in enumerate(h))/(after.width*(y1-y0)*3)
                        record['source_region_mae'][label]=round(value,3)
                    record['comparison_to_owner_reference']='EXECUTED: source/baseline and source/candidate diffs + overlays + regional metrics'
        records.append(record)
(root/'comparison-report.json').write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding='utf-8')
for r in records:
    print(r['page'],r['before_after'],';',r['comparison_to_owner_reference'])
    if 'reference_relative_error_reduction_percent' in r:
        print('  RGB MAE before:',r['reference_before_mae_0_to_255'],
              'after:',r['reference_mae_0_to_255'],
              'relative reduction:',r['reference_relative_error_reduction_percent'],'%')
