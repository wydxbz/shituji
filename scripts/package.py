from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil

root = Path(__file__).resolve().parents[1]
release = root / 'releases'
release.mkdir(exist_ok=True)
plugin = release / 'shituji-extension-v1.0.0.zip'
with ZipFile(plugin, 'w', ZIP_DEFLATED) as archive:
    for file in sorted((root / 'extension').rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(root / 'extension').as_posix())
    archive.write(root / 'LICENSE', 'LICENSE')
(root / 'docs' / 'releases').mkdir(exist_ok=True)
shutil.copy2(plugin, root / 'docs' / 'releases' / plugin.name)
source = root.parent / 'shituji-complete-project.zip'
with ZipFile(source, 'w', ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob('*')):
        rel = file.relative_to(root)
        if not file.is_file() or any(p in {'.git', '.test-profile', 'node_modules'} for p in rel.parts):
            continue
        if rel.as_posix().startswith('test-results/downloads/'):
            continue
        archive.write(file, 'shituji/' + rel.as_posix())
with ZipFile(plugin) as archive:
    assert 'manifest.json' in archive.namelist()
    assert archive.testzip() is None
print('Extension ZIP:', plugin)
print('Full project ZIP:', source)
