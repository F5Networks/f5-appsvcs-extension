# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color


#Get BIG IP Information
BIGIP_IP_ADDRESS=$1
AS3_USERNAME=$2
AS3_PASSWORD=$3
AWS_KEY_ID=$4
AWS_SECRET_KEY=$5
AWS_TARGET_TAG_VALUE=$6
AWS_INITIAL_REGION=$(cat scripts/service-discovery/sd-node.json | grep awsRegion | awk '{ print$2 }' | tr -d '"' | tr -d ',')
TAGS_KEY=$(cat scripts/service-discovery/sd-node.json | grep awsNodeTagName | awk '{ print$2 }' | tr -d '"' | tr -d ',')
TAGS_VALUE=$(cat scripts/service-discovery/sd-node.json | grep $AWS_TARGET_TAG_VALUE | awk '{ print$2 }' | tr -d '"' | tr -d ',')

if [ -z "$BIGIP_IP_ADDRESS" ]; then
    echo -e "${RED}BIGIP_IP_ADDRESS is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$AS3_USERNAME" ]; then
    echo -e "${RED}AS3_USERNAME is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$AS3_PASSWORD" ]; then
    echo -e "${RED}AS3_PASSWORD is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$AWS_KEY_ID" ]; then
    echo -e "${RED}AWS_KEY_ID is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$AWS_SECRET_KEY" ]; then
    echo -e "${RED}AWS_SECRET_KEY is required as a parameter.${NC}"
    exit 1
fi

if [ -z "$AWS_TARGET_TAG_VALUE" ]; then
    echo -e "${RED}AWS_TARGET_TAG_VALUE is required as a parameter.${NC}"
    exit 1
fi

echo $BIGIP_IP_ADDRESS
echo $TAGS_KEY
echo $TAGS_VALUE
#Send a declartion with AS3 to the BIG IP
curl -sk -u $AS3_USERNAME:$AS3_PASSWORD https://$BIGIP_IP_ADDRESS/mgmt/shared/appsvcs/declare -H 'Content-Type: application/json' -X POST  -d '{
	 "class": "AS3",
  "declaration": {
    "controls": {
    "class": "Controls",
    "logLevel": "info"
   },
  "class": "ADC",
  "schemaVersion": "3.1.0",
    "id": "TEST_Service_HTTP",
    "TenantTestSD": {
      "class": "Tenant",
      "Generic_Http_Node": {
        "class": "Application",
        "template": "generic",
        "vghSimple": {
          "class": "Service_HTTP",
          "virtualAddresses": [
            "10.1.88.12"
          ],
           "pool": "web_pool_aws"
        },
              "web_pool_aws": {
        "class": "Pool",
        "monitors": [
          "http"
        ],
        "members": [
          {
            "servicePort": 8082,
            "addressDiscovery": "aws",
            "updateInterval": 10,
            "tagKey": "'$TAGS_KEY'",
            "tagValue": "'$TAGS_VALUE'",
            "addressRealm": "private",
            "region": "'$AWS_INITIAL_REGION'",
            "accessKeyId": "'$AWS_KEY_ID'",
            "secretAccessKey": "'$AWS_SECRET_KEY'",
            "credentialUpdate": false
          }
        ]
       }
      }
    }
  }
}' -k -H "Expect:"
