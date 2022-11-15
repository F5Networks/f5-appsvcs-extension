# AS3 Common Tenant

## The Common Tenant is processed twice in AS3
* First time:
  * Creates will be done the first time Common is processed.
* Second time:
  * Deletes will be done the second time Common is processed.
  * Modifies will also be done the second time.
    * This includes both modify commands and the equivalent create/delete commands.
  * Creates that either failed or weren't processed the first time will also be done as part of the second time.
* The boolean firstPassNoDelete will determine which pass it is.
  * If set to true, it will be the first pass.
  * If set to false, it will be the second pass or another tenant.
    * It is set to false immediately after the first pass.

## Renaming in the Common tenant
* There will be problems when renaming objects that reference things that can only be referenced once.
  * The first pass of /Common will fail because we don't do deletes in that pass.
  * The second pass of /Common will succeed since we do deletes and modifies in the second pass.
  * This includes Service_Address, GSLB_Server, and services that use a Service_Address. There are likely other cases out there as well.
* Renaming in cases where a reference can be used by multiple objects will not be a problem.
* There is a diff.kind of 'R' that can be used to specify cases that do not support a rename.
  * The kind of 'R' is set in fetch.addRenameCase().
  * We check for the 'R' case and reject if it is present in diffProcessor.
  * Both passes of /Common will fail if a kind of 'R' is being set.
