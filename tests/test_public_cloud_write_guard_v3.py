#!/usr/bin/env python3
"""Synthetic security regression tests for reviewed static Cloud JS assets."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "check_public_cloud_writes_v3",
    ROOT / "scripts" / "check_public_cloud_writes_v3.py",
)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class CloudWriteAuditTests(unittest.TestCase):
    def test_current_reviewed_public_scripts(self):
        self.assertEqual(guard.main(), 0)

    def test_rejects_unbound_reset(self):
        self.assertTrue(guard.inspect_script(
            "other.js", "await client.rpc('aim_reset_my_progress')"
        ))

    def test_rejects_direct_insert_update_upsert_delete(self):
        for table in guard.TABLES:
            for method in ("insert", "upsert", "update", "delete"):
                with self.subTest(table=table, method=method):
                    source = f"await client.from('{table}').{method}([])"
                    self.assertTrue(guard.inspect_script(guard.OWNER_MODULE, source))

    def test_rejects_another_module_using_guarded_rpc(self):
        self.assertTrue(guard.inspect_script(
            "account-v7.mjs", "await client.rpc('aim_apply_progress_for_user', {})"
        ))

    def test_rejects_cloud_table_access_outside_owner(self):
        self.assertTrue(guard.inspect_script(
            "site.js", "const x=await supabase.from('aim_sessions').select('*')"
        ))

    def test_preserves_owner_read_only_and_guarded_rpc(self):
        source = (
            "await client.from('aim_sessions').select('payload')\n"
            "await client.rpc('aim_apply_progress_for_user', {expected_uid:uid})"
        )
        self.assertEqual(guard.inspect_script(guard.OWNER_MODULE, source), [])


if __name__ == "__main__":
    unittest.main()
