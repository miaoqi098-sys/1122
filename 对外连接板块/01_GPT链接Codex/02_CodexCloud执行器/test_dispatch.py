from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("dispatch.py")
spec = importlib.util.spec_from_file_location("codex_cloud_dispatch", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)


class DispatchValidationTests(unittest.TestCase):
    def valid_task(self):
        return {
            "task_id": "20260917-stage-constraint-engine-v1",
            "task_type": "engineering_task",
            "created_at": "2026-09-17T10:00:00Z",
            "repository": "miaoqi098-sys/1122",
            "base_branch": "main",
            "work_branch": "codex/stage-constraint-engine-v1",
            "spec_path": ".codex-cloud/tasks/20260917-stage-constraint-engine-v1.md",
            "title": "Implement Stage Engine V1 and Constraint Engine V1",
        }

    def test_valid_task(self):
        clean = module.validate_task(self.valid_task())
        self.assertEqual(clean["repository"], "miaoqi098-sys/1122")

    def test_rejects_wrong_repository(self):
        task = self.valid_task()
        task["repository"] = "other/repo"
        with self.assertRaises(module.DispatchError):
            module.validate_task(task)

    def test_rejects_non_codex_branch(self):
        task = self.valid_task()
        task["work_branch"] = "main"
        with self.assertRaises(module.DispatchError):
            module.validate_task(task)

    def test_rejects_spec_path_escape(self):
        task = self.valid_task()
        task["spec_path"] = ".codex-cloud/tasks/../secret.md"
        with self.assertRaises(module.DispatchError):
            module.validate_task(task)

    def test_rejects_remote_command_fields(self):
        task = self.valid_task()
        task["command"] = "rm -rf /"
        with self.assertRaises(module.DispatchError):
            module.validate_task(task)

    def test_read_spec_and_payload_are_bounded(self):
        task = module.validate_task(self.valid_task())
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            path = root / task["spec_path"]
            path.parent.mkdir(parents=True)
            path.write_text("# Task\nImplement deterministic engines.\n", encoding="utf-8")
            text = module.read_spec(task, root)
            payload = module.build_session_payload(task, text, "ephemeral-token", "gpt-test")
            self.assertEqual(payload["environment"]["type"], "openai_hosted")
            self.assertEqual(payload["agent"]["model"], "gpt-test")
            self.assertIn("AGENTS.md", payload["agent"]["instructions"])
            self.assertNotIn("ephemeral-token", json.dumps(payload["agent"]))


if __name__ == "__main__":
    unittest.main()
