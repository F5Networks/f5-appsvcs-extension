# Accessing Stored Declarations

## Overview
- AS3 stores the last 4 (default value) *successful* AS3 declarations in LTM datagroups on the target BIG-IP
- The number of AS3 declarations that get stored on the BIG-IP is controlled via the `historyLimit` property on [the AS3 request class](https://clouddocs.f5.com/products/extensions/f5-appsvcs-extension/latest/refguide/schema-reference.html#as3)

## Accessing Declarations
- All of the successful declarations can be listed in TMSH: `list ltm data-group`, where the entries are named `____appsvcs_declaration-<timestamp>`

### Decrypting Declarations
- The actual AS3 declaration is Base64 encoded, ZLIB compressed and stored as a 'record' within its own data group. The declarations can be decoded, and 2 examples are shown below:
1.  Using bash (note: the `base64` command on Linux/BIG-IP may require the longform option: `--decode`):
```
echo 'eNr…’ | base64 -d | zlib-flate -uncompress | jq .
```
2.  Using NodeJS code
```
const zlib = require('zlib');
const data = 'eNr…’;
console.log(zlib.unzipSync(Buffer.from(data, 'base64')).toString());
```
