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
                    ref_diff=ImageChops.difference(ref,after)
                    ref_diff.save(root/f'{name}-source-diff.png',optimize=True)
                    Image.blend(ref,after,.5).save(root/f'{name}-source-overlay.png',optimize=True)
                    h=ref_diff.histogram()
                    absolute_error=sum((v%256)*count for v,count in enumerate(h))
                    record['reference_mae_0_to_255']=round(absolute_error/(after.width*after.height*3),3)
                    record['comparison_to_owner_reference']='EXECUTED: pixel difference and overlay generated'
        records.append(record)
(root/'comparison-report.json').write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding='utf-8')
for r in records:
    print(r['page'],r['before_after'],';',r['comparison_to_owner_reference'])
