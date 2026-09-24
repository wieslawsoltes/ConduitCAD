"""Independently audit the three shipped DXF examples using ezdxf."""
from pathlib import Path
import json
import ezdxf

ROOT = Path(__file__).resolve().parents[1]
reports = []
for path in sorted((ROOT / "samples").glob("*.dxf")):
    document = ezdxf.readfile(path)
    auditor = document.audit()
    reports.append({
        "file": str(path.relative_to(ROOT)),
        "ezdxfVersion": ezdxf.__version__,
        "dxfVersion": document.dxfversion,
        "entities": len(document.modelspace()),
        "errors": [{"code": item.code, "message": item.message} for item in auditor.errors],
        "fixes": [{"code": item.code, "message": item.message} for item in auditor.fixes],
    })
output = ROOT / "artifacts" / "dxf-audit.json"
output.parent.mkdir(exist_ok=True)
output.write_text(json.dumps(reports, indent=2) + "\n")
print(json.dumps(reports, indent=2))
assert len(reports) == 3, "Expected three sample DXFs"
assert all(not r["errors"] and not r["fixes"] for r in reports), "DXF audit reported errors or repairs"
