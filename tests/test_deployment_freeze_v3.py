#!/usr/bin/env python3
"""Prevent accidental V3 Pages deployment before explicit owner release signoff.

These tests use only workflow text and never contact GitHub or deploy anything.
"""
from pathlib import Path
import unittest

WORKFLOWS=Path(__file__).resolve().parents[1]/'.github'/'workflows'


class PublicationFreezeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.publish=(WORKFLOWS/'publish-pages.yml').read_text(encoding='utf-8')
        cls.recover=(WORKFLOWS/'recover-pages.yml').read_text(encoding='utf-8')

    def test_publish_requires_manual_dispatch_not_main_push(self):
        header=self.publish.split('\npermissions:',1)[0]
        self.assertIn('workflow_dispatch:',header)
        self.assertNotIn('\n  push:',header)
        self.assertNotIn('pull_request:',header)

    def test_release_is_main_only_with_four_manual_attestations(self):
        for check in (
            "github.event_name == 'workflow_dispatch'",
            "github.ref == 'refs/heads/main'",
            "inputs.release_confirmation == 'PUBLIER_AIMROUTINE_V3'",
            'inputs.four_originals_reviewed == true',
            'inputs.disposable_accounts_verified == true',
            'inputs.account_bound_reset_verified == true',
        ):
            self.assertIn(check,self.publish)
        for item in ('release_confirmation:','four_originals_reviewed:',
                     'disposable_accounts_verified:','account_bound_reset_verified:'):
            self.assertIn(item,self.publish)

    def test_archived_recovery_cannot_deploy_or_cancel_pages(self):
        header=self.recover.split('\npermissions:',1)[0]
        self.assertNotIn('\n  push:',header)
        self.assertNotIn('pull_request:',header)
        self.assertNotIn('pages: write',self.recover)
        self.assertNotIn('id-token: write',self.recover)
        self.assertNotIn('actions/deploy-pages@',self.recover)
        self.assertNotIn('actions/upload-pages-artifact@',self.recover)
        self.assertNotIn('/pages/deployments/',self.recover)

    def test_only_approved_publisher_can_deploy(self):
        deployers=[
            p.name for p in WORKFLOWS.glob('*.yml')
            if 'actions/deploy-pages@' in p.read_text(encoding='utf-8')
        ]
        self.assertEqual(deployers,['publish-pages.yml'])

    def test_publisher_still_tests_and_builds_public_only(self):
        for command in (
            'node --test tests/*core.test.mjs',
            'test_private_source_fidelity_gate_v3.py',
            'test_stage_public_visual_evidence_v3.py',
            'python3 tests/check_secrets.py',
            'python3 scripts/check_reset_release_ready.py',
            'python3 scripts/build_public.py',
            'python3 tests/check_public_artifact.py',
            'python3 tests/check_site.py',
        ):
            self.assertIn(command,self.publish)


if __name__=='__main__':
    unittest.main()
