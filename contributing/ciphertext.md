I have this email originally from Mark Quevedo about ciphertext and passphrase that I think is worth keeping and sharing.

```
Sent: Thursday, February 15, 2018 3:09 PM
To: Rob Cupples; Fred Slater
Cc: Joe Jordan; Nojan Moshiri; Michael Shimkus
Subject: RE: f5-appsvcs | Need help on how to formulate passphrase for cookie persistence. (#51)

Hi Rob,

When putting a passphrase (or similar)
into an AS3 declaration, you have to encode
it in base64 and put it into the “ciphertext”
property of the “passphrase” object and
set the “protected” property to a suitable
value.

The “protected” property indicates how/
whether the passphrase in the “ciphertext”
property is encrypted (inside the mandatory
base64 encoding).

There are only two values for “protected” at
this time:

eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0=
eyJhbGciOiJkaXIiLCJlbmMiOiJmNXN2In0=

The = signs at the end are optional.

The one that ends in “5lIn0” means that
“ciphertext” is really just the passphrase
encoded in base64, so for example, the
passphrase “f5” turns into “ZjU=” – there
is no actual encryption involved in this case.

The other value for “protected” that ends in
“N2In0” means that “ciphertext” is a BIG-IP
SecureVault cryptogram (encoded in base64).
Only a BIG-IP can create one of those, and
only the same BIG-IP (or a BIG-IP in the same
HA cluster) can decrypt it later.

For security, when you give AS3 the first
value and a passphrase (or similar)
unencrypted in base64, AS3 gets the target
BIG-IP to encrypt that passphrase into a
SecureVault cryptogram.  Then AS3 returns
that to you (in reply to your RESTful POST
operation) and stores the passphrase that
way within AS3.  AS3 tosses the unencrypted
value so it can’t be leaked later.

(I don’t recommend this, because it cannot
be used to transfer a passphrase from one
BIG-IP to another unless they are part of the
same HA cluster, but:  if something on your
BIG-IP already has a passphrase, you can
copy it from tmsh or out of a bigip.conf file.
It will look like “$M$iA$pEOCnRlP9Zr1y+/NTNfaFw==”.
Then you can paste it (after you encode it in
base64) into a “ciphertext” property in your
declaration.  You have to set the “protected”
value appropriately.  You may then use that
declaration only with the BIG-IP (or cluster)
from which you got the encrypted passphrase.)

Let me know your thoughts,

Cordially,

Mark

From: Rob Cupples
Sent: Thursday, February 15, 2018 2:37 PM
To: Mark Quevedo; Fred Slater
Subject: RE: f5-appsvcs | Need help on how to formulate passphrase for cookie persistence. (#51)

I’d like to understand how I can create my own values for “ciphertext” and “protected”.
```
