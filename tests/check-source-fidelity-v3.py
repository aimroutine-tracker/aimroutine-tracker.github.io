#!/usr/bin/env python3
"""Release gate: four original source PNGs AND four measured source comparisons.
This script intentionally blocks release when the owner's originals are absent.
A passing gate validates the evidence inputs, NOT pixel-perfect fidelity.
"""
from pathlib import Path
import hashlib, json, struct, sys

root=Path(__file__).parent/'visual-references'
evidence=Path('visual-results')
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
report_path=evidence/'comparison-report.json'
names=('home','routines','progress','account')
errors=[]
if not report_path.is_file():
    errors.append('Missing original-versus-candidate comparison report from Chromium.')
    entries={}
else:
    entries={x.get('page'):x for x in json.loads(report_path.read_text(encoding='utf-8'))}
for name in names:
    meta=manifest['references'][name]
    source=root/meta['filename']
    if not source.is_file():
        errors.append(f'{name}: required original PNG missing: {source}')
        continue
    raw=source.read_bytes()
    sha=hashlib.sha256(raw).hexdigest()
    if sha!=meta['sha256']:
        errors.append(f'{name}: original PNG SHA-256 mismatch; do not substitute a converted screenshot.')
        continue
    if len(raw)<24 or raw[:8]!=b'\x89PNG\r\n\x1a\n':
        errors.append(f'{name}: not a valid PNG.')
        continue
    width,height=struct.unpack('>II',raw[16:24])
    if (width,height)!=(1672,941):
        errors.append(f'{name}: incorrect original PNG dimensions {width}x{height}; expected 1672x941.')
    row=entries.get(name)
    if not row or not row.get('comparison_to_owner_reference','').startswith('EXECUTED:'):
        errors.append(f'{name}: original-versus-candidate comparison NOT EXECUTED in this run.')
    if not (evidence/f'{name}-source-diff.png').is_file():
        errors.append(f'{name}: source pixel-diff artifact is missing.')
    if not (evidence/f'{name}-source-overlay.png').is_file():
        errors.append(f'{name}: source overlay artifact is missing.')
    if row and not isinstance(row.get('reference_mae_0_to_255'),(int,float)):
        errors.append(f'{name}: quantitative source pixel error missing.')
    if row and not isinstance(row.get('reference_before_mae_0_to_255'),(int,float)):
        errors.append(f'{name}: source-to-baseline error missing; cannot prove before/after improvement.')
    if row and row.get('source_visual_regressed') is True:
        errors.append(f'{name}: candidate visually regressed by more than 0.25 RGB MAE against original.')
    if row and set(row.get('source_region_mae',{}))!={'header','hero','mid','lower'}:
        errors.append(f'{name}: regional source comparison is missing or incomplete.')
    # The right-side hero artwork is a source-backed, fixed visual region.
    # Require its private before/after measurement to avoid losing alignment
    # gains under whole-screen differences from authentic empty data states.
    hero_bounds={
        'home':[780,55,1672,355],
        'routines':[780,55,1672,300],
        'progress':[780,55,1672,260],
        'account':[780,55,1672,300],
    }[name]
    if row and row.get('source_hero_art_bounds')!=hero_bounds:
        errors.append(f'{name}: owner hero-art crop was changed or omitted.')
    if row and not all(isinstance(row.get(k),(int,float)) and row[k]>=0 for k in
        ('source_hero_art_before_mae_0_to_255','source_hero_art_mae_0_to_255')):
        errors.append(f'{name}: quantitative owner hero-art before/after comparison is missing.')
    if row and row.get('source_hero_art_regressed') is True:
        errors.append(f'{name}: hero-art fidelity regressed against the original.')
if errors:
    print('BLOCKED: release cannot claim reference fidelity.')
    for e in errors: print(' -',e)
    print('Next: add four byte-identical PNGs listed in tests/visual-references/README.md; rerun CI.')
    sys.exit(1)
print('SOURCE EVIDENCE VERIFIED for all four pages.')
print('Note: this input gate is NOT a pixel-perfect signoff. Human visual approval is still required.')
