# AS3 Testing
AS3 testing makes use of [Mocha](https://mochajs.org/) as a test runner.
The Mocha [usage](https://mochajs.org/#usage) documentation is worth taking a look at to learn how to do things like stopping on the first failure with the `--bail` option and filtering the tests that are run with the `--grep` option. Other options we use:
* If `npx` is available on your system, you can run the locally installed version of Mocha (from `npm install`) by using `npx mocha`.
* To run a specific test or directory of tests, specify that file or directory in the Mocha command: `npx mocha test/unit`.
Since mocha defaults to looking in the `test` directory for tests, all tests can be run with the command `npx mocha --recursive`.
* The `--recursive` option tells mocha to look in sub-directories for tests.
## For integration testing
* The `--require` option tells Mocha where its hooks are. Proper usage for us is
`--require test/integration/bigip/property/mochaHooks.js`
* The `--parallel` option tells mocha to run the tests in parallel. This only works on mocha version 8+ so is limited to integration testing.

## Environment Variables
One of the easiest ways to get information into Mocha (e.g. test targets and credentials) is through environment variables, and this is how we do it for AS3 testing.
Environment variables are required for running any of the integration tests, but the unit tests do not make use of any environment variables.
Below is a list of the environment variables that some tests look for:

AS3 integration tests can be run in serial mode or in parallel mode and there are some differences in environment variables based on the mode

### All modes
* TEST_RESOURCES_URL -- The URL at which to find policies and certs required for certain integration tests
    * propertiesAccessProfile.js
    * propertiesCertificate.js
    * propertiesEndpointPolicy.js
    * propertiesMonitor.js
    * propertiesPerRequestAccessPolicy.js
    * propertiesServiceHTTP.js
    * propertiesWAFPolicy.js
    * performanceCommon.js
* DISCOVERY_AWS_ID -- The value to use for accessKeyId when testing service discovery on AWS
* DISCOVERY_AWS_SECRET -- The value to use for secretAccessKey when testing service discovery on AWS
* ARM_SUBSCRIPTION_ID -- The value to use for subscriptionId when testing service discovery on AZURE
* ARM_TENANT_ID -- The value to use for directoryId when testing service discovery on AZURE
* ARM_CLIENT_ID -- The value to use for applicationId when testing service discovery on AZURE
* ARM_CLIENT_SECRET -- The value to use for apiAccessKey when testing service discovery on AZURE
* DISCOVERY_GCE_SECRET -- The value to use for encodedCredentials when testing service discovery on GCE
* DOCKER_IMAGE -- The docker image and tag to use when launching an AS3 container for testing (Example: f5-as3-container:3.10.0-5)
* DOCKER_ID -- The ID of a container running an AS3 image
* CONSUL_URI -- The URI of the Consul server
* CONSUL_URI_NODES -- The URI of the nodes that are registered on the Consul server

### Integration test serial mode
* AS3_HOST -- The IP address, and optionally port, of a BIG-IP target (Example: 192.0.2.42:8443)
* AS3_USERNAME -- The username to authenticate to a BIG-IP with
* AS3_PASSWORD -- The password to authenticate to a BIG-IP with

### Integration test parallel mode
* PARALLEL - set to `true`
* RESERVATION_SERVER_HOST - The IP address of the reservation server from which to reserve a host for a test suite
* RESERVATION_SERVER_PORT - Port of the reservation server
* SERVER_SET - The ID of the server set for this test run (pipeline)

### Testing from GitLab UI
When testing from the GitLab UI, you have the option of running a manual test with various AS3 runtime and test code versions
* Go to GitLab f5-appsvcs-extension -> CI/CD -> Run Pipeline
  * BIGIP_IMAGE -- The name of the BIG-IP image to use
  * FORCE_INTEGRATION_TEST -- Set to true
  * RPM_PACKAGE_URL -- If you want to get the RPM from somewhere besides the build_rpm job, enter the the URL to the file
  * TEST_CODE_VERSION -- The branch or tag from which to pull test code

## BIG-IP Integration Tests
Location: `test/integration/bigip`

The BIG-IP integration tests are run using Mocha. They require
* node 8
* That the AS3_HOST, AS3_USERNAME, AS3_PASSWORD, and TEST_RESOURCES_URL environment variables to be set.

If you need BIG-IP test devices to test with, visit:
* `test/common/env/terraform/plans/azure/README.md` for Azure.
* `test/common/env/terraform/plans/openstack/README.md` for openstack(VIO).

### Misc Tests
Location: `test/integration/bigip/misc`

This subset of BIG-IP integration tests are run on a specified BIG-IP with Mocha.

### Property Tests
Location: `test/integration/bigip/property`

This subset of BIG-IP integration tests generates AS3 declarations based on lists of properties, and then performs specific actions with those declarations to look for common issues.
The steps a property test goes through are listed below.

1. A DELETE request is sent to the `/declare` endpoint
1. A declaration is generated with the item under test being minimally defined
1. A POST request is sent to the `/declare` endpoint using the minimally defined declaration
1. The same request is made a second time looking for "no changes" results
1. The state of BIG-IP is analyzed through iControl REST calls to make sure the declaration made the appropriate modifications
1. A declaration with all properties specified for the item under test is generated to look for update problems
1. A POST request is sent to the `/declare` endpoint using the fully defined declaration
1. The same request is made a second time looking for "no changes" results
1. The state of BIG-IP is analyzed through iControl REST calls to make sure the declaration made the appropriate modifications
1. A POST request is sent to the `/declare` endpoint using the minimally defined declaration (this helps to find problems with defaults)
1. The same request is made a second time looking for "no changes" results
1. The state of BIG-IP is analyzed through iControl REST calls to make sure the declaration made the appropriate modifications
1. A DELETE request is sent to the `/declare` endpoint

### Service Discovery Tests
Location: `test/integration/bigip/serviceDiscovery.js`

This subset of BIG-IP integration tests focuses on testing service discovery features.
In addition to the usual BIG-IP integration test environment variables, the DISCOVERY_AWS_ID, DISCOVERY_AWS_SECRET, ARM_CLIENT_SECRET, and DISCOVERY_GCE_SECRET variables are required based on the specific tests being run.

## BIG-IQ Integration Tests
Location: `test/bigiq.collection.json`

The BIG-IQ test is a Postman collection.
To run it, use Postman or Newman instead of Mocha.

## Container Integration Tests
Location: `test/container`

Container integration tests are run using Mocha and require the AS3_HOST, AS3_USERNAME, and AS3_PASSWORD environment variables to be set.
Additionally, either the DOCKER_IMAGE or DOCKER_ID environment variable must be set.

## Performance Tests
Location: `test/performance`

Performance tests can be run in the same way as integration tests using Mocha.
While a test is running, some basic results will be printed to stdout.
When a run is complete, result files are written out to `test/logs/performance`.
These output files include a `.csv` file and a `.plot` file.
The `.plot` file can be used to generate an image with gnuplot with the command `gnpulot -c path/to/plot/file`.
The range and number of steps can be adjusted by modifying `test/performance/performanceCommon.js`.

NOTE: Information on an alternative set of performance tests for AS3 can be found on Confluence under the name `AS3 Performance Testing`.

NOTE: See also [Performance Testing](#performance-testing) for information on collecting performance data with Jaeger

## Unit Tests
Location: `test/unit`

These are just simple unit tests that are run with Mocha. No BIG-IP or environment variables required.

## Randomized Tests
Location: `test/random`

These tests are meant to use constrained randomized testing to look for unexpected corner cases.
They are mostly in a proof of concept stage and are not used during regular AS3 testing.

## Upgrade Test
Upgrade testing is not yet automated.
Below are the manual steps to perform a basic upgrade test.
This testing should be done with the previous release and LTS release.

1. Install the previous version of AS3 on a BIG-IP.
1. POST `examples/example-all.json` from the previous version.
1. Upgrade to the current version of AS3.
1. POST `examples/example-all.json` from the current version.
1. Confirm that the declaration is successful.
1. DELETE the declaration.
1. Confirm the delete was successful.

## Performance testing
Aside from the [specialized performance tests](#performance-tests), we can also collect performance information on standard property tests.
### Set up for Jaeger collector
More info at https://logz.io/blog/jaeger-and-the-elk-stack/
1. Run Ubuntu instance in VIO

    + Name: as3-jaeger-collector
    + Image: Ubuntu18.04LTS-pristine
    + Size: m1.medium
    + AdminNetwork

    Set root user password to our usual

1. Install Java
    ```
    apt update
    apt install openjdk-8-jdk -y
    ```
1. Install Docker
    ```
    apt update
    apt -y install apt-transport-https ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt update
    apt -y install docker-ce docker-ce-cli containerd.io
    ```
1. Install and run ElasticSearch
    ```
    docker pull elasticsearch:6.8.0
    docker run --rm -d --name=elasticsearch -e "ES_JAVA_OPTS=-Xms500m -Xmx500m" -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" -e "xpack.security.enabled=false" elasticsearch:6.8.0
    ```
1. Install and run Kibana
    ```
    docker pull kibana:6.8.0
    docker run --rm -d --link=elasticsearch --name=kibana -p 5601:5601 kibana:6.8.0
    ```
1. Install and run Jaeger
    ```
    docker pull rancher/jaegertracing-all-in-one:1.20.0
    docker run --rm -d --link=elasticsearch --name=jaeger -e SPAN_STORAGE_TYPE=elasticsearch -e ES_SERVER_URLS=http://elasticsearch:9200 -e JAEGER_SAMPLER_TYPE=const -e JAEGER_SAMPLER_PARAM=1 -e ES_TAGS_AS_FIELDS_ALL=true -p 6831:6831/udp -p 6832:6832/udp -p 14268:14268 -p 16686:16686 rancher/jaegertracing-all-in-one:1.20.0
    ```
    * Jaeger UI will be running at http://<ip_address>:16686 (go/as3jaeger)
    * Kibana will be running at http://<ip_address>:5601

1. Turn on tracing in AS3
Post to the settings endpoint with
    ```
    {
        "performanceTracingEnabled": true,
        "performanceTracingEndpoint": "http://<ip_address>:14268/api/traces",
    }
    ```
1. Once there is some data, go to the kibana UI and add an index pattern of `jaeger-span-*`. See [Kibana Docs](https://www.elastic.co/guide/en/kibana/index.html)

## Resetting cloud credential secrets
All credentials are in our CI/CD variables.

### Azure
This is most easily done with the `az` CLI.

Get the ID of our user
```
az ad sp list --filter "appId eq '<ARM_CLIENT_ID>'" | jq .[].id
```

Reset the secret
```
az ad sp credential reset --id <the_id>
```

Update the `ARM_CLIENT_SECRET` value with the password in the output.

### AWS
This has to be done through a service ticket. Look at our `DISCOVERY_AWS_ID` and submit a ticket to have the associated user's key deleted and recreated.

### GCE
* Find our user in the Google Cloud console under the `Service Accounts` page.
* Go to the `KEYS` tab.
* Click the trash can icon.
* Click `ADD KEY` and select JSON format.
* base64 encode the file that is downloaded to your computer.
* Update the `DISCOVERY_GCE_SECRET` value with the base64 encoded data.
* Delete the downloaded file.

## GitLab Runners (SME - Rob Cupples)
We have often had our own GitLab Runner(s) to handle deployment, integration testing, and tear down. We have a page in our team's docs space that describes how we have been setting them up.

If you ever have problems with them rebooting the instance almost always quick-fixes it. If you need to login,check the CI/CD variables.
