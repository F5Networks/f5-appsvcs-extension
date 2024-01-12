OUTPUT_LOCATION=./deployment_info
set -e

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

if [ -z "$BIGIP_VERSION" ]; then
    echo -e "${RED}BIGIP_VERSION is required.${NC}"
    exit 1
fi

if [ -z "$F5_CIDR_BLOCKS" ]; then
    echo -e "${RED}F5_CIDR_BLOCKS is required.${NC}"
    exit 1
fi

if [[ -n $1 ]]; then
    OUTPUT_LOCATION="$1"
fi

cd ${TF_ROOT}/plans/azure
gitlab-terraform init
gitlab-terraform plan -var="bigip_version=${BIGIP_VERSION}" -var="f5_cidr_blocks=${F5_CIDR_BLOCKS}"
gitlab-terraform apply
echo $(gitlab-terraform output -json) | jq .deployment_info.value -r > "$OUTPUT_LOCATION"
