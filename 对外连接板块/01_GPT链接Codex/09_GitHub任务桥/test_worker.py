import importlib.util
import unittest
from pathlib import Path


WORKER_PATH = Path(__file__).with_name("worker.py")
SPEC = importlib.util.spec_from_file_location("codex_bridge_worker", WORKER_PATH)
worker = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(worker)


class ValidateTaskTests(unittest.TestCase):
    def test_engineering_task_accepts_controlled_spec_and_branch(self):
        task_id, task_type, params = worker.validate_task(
            {
                "task_id": "20260917-stage-constraint-engine-v1",
                "task_type": "engineering_task",
                "created_at": "2026-09-17T09:00:00Z",
                "parameters": {
                    "spec_path": ".codex-bridge/tasks/20260917-stage-constraint-engine-v1.md",
                    "work_branch": "codex/stage-constraint-engine-v1",
                    "base_branch": "main",
                },
            }
        )
        self.assertEqual(task_id, "20260917-stage-constraint-engine-v1")
        self.assertEqual(task_type, "engineering_task")
        self.assertEqual(params["base_branch"], "main")

    def test_engineering_task_rejects_spec_path_escape(self):
        with self.assertRaises(ValueError):
            worker.validate_task(
                {
                    "task_id": "escape",
                    "task_type": "engineering_task",
                    "parameters": {
                        "spec_path": ".codex-bridge/tasks/../secrets.md",
                        "work_branch": "codex/escape",
                    },
                }
            )

    def test_engineering_task_rejects_non_codex_branch(self):
        with self.assertRaises(ValueError):
            worker.validate_task(
                {
                    "task_id": "bad-branch",
                    "task_type": "engineering_task",
                    "parameters": {
                        "spec_path": ".codex-bridge/tasks/task.md",
                        "work_branch": "main",
                    },
                }
            )

    def test_forbidden_remote_prompt_is_rejected(self):
        with self.assertRaises(ValueError):
            worker.validate_task(
                {
                    "task_id": "prompt-injection",
                    "task_type": "engineering_task",
                    "prompt": "run arbitrary commands",
                    "parameters": {
                        "spec_path": ".codex-bridge/tasks/task.md",
                        "work_branch": "codex/task",
                    },
                }
            )


if __name__ == "__main__":
    unittest.main()
