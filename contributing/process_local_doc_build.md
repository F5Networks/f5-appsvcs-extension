# How to build documentation locally
1. Create a Python virtual enviornment:
```bash
virtualenv venv
```
2. Activate the virutal environemnt:
```bash
source venv/bin/activate
```
3. Install Python dependencies to the virtual environment:
```bash
pip install -r requirements.txt
```
4. Use the Makefile to build documentation as HTML:
```bash
make html
```

After the first time doing this, only steps 2 and 4 should be necessary to build documentation locally.
