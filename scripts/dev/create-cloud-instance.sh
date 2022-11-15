OUTPUT_LOCATION=./deployment_info
set -e

if [[ -n $1 ]]; then
    OUTPUT_LOCATION="$1"
fi

cd ${TF_ROOT}/plans/azure
gitlab-terraform init
gitlab-terraform plan -var="bigip_version=${BIGIP_VERSION}" -var="f5_cidr_blocks=${F5_CIDR_BLOCKS}"
gitlab-terraform apply
echo $(gitlab-terraform output -json) | jq .deployment_info.value -r > "$OUTPUT_LOCATION"
