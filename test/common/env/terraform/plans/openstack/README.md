# Deploy for openstack(VIO) using terraform.

## Manual deployment

**NOTE:** You'll need to generate access token to have access to Gitlab's terraform state files:
        Go to `Settings` -> `Access Tokens` and generate api token:

        export TF_HTTP_USERNAME=<your olymus username>
        export TF_HTTP_PASSWORD=<token>

**NOTE:** To deploy instance(s) without reporting to Gitlab's state, go and edit `main.tf` file and comment these two lines:
          backend "http" {
          }

0. You'll need a terraform binary or use docker container.

1. Setup environment variables needed for your project:
        **NOTE:** If using VIO you can pull the following information from your profile OpenStack RC File

        export OS_AUTH_URL=https://<your vio domain>:5000/v3
        export OS_INSECURE=true
        export OS_PASSWORD=<password for user>
        export OS_PROJECT_DOMAIN_ID=default
        export OS_PROJECT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
        export OS_PROJECT_NAME=<your project name>
        export OS_REGION_NAME=nova
        export OS_USER_DOMAIN_NAME=Default
        export OS_USERNAME=<your username>
        export REGKEY=<license key>
        export TF_HTTP_ADDRESS=<your gitlab domain>/api/v4/projects/<project id>/terraform/state/openstack-<BIGIP major version>

1. Change dir to test/common/env/terraform/plans/openstack.

1. Run `terraform init` output should be like:

        Initializing the backend...

        Initializing provider plugins...
        - Reusing previous version of terraform-provider-openstack/openstack from the dependency lock file
        - Reusing previous version of hashicorp/template from the dependency lock file
        - Using previously-installed terraform-provider-openstack/openstack v1.42.0
        - Using previously-installed hashicorp/template v2.2.0

        Terraform has been successfully initialized!

1. Check your terraform plan, run `plan`:

        terraform plan -var bigip_version="$BIGIP_IMAGE"

1. After initialization successful, run `apply`:

        terraform apply -var bigip_version="$BIGIP_IMAGE" -auto-approve

1. After deployment successfull you'll get output like:

        Outputs:
        admin_ip = [
          "BIGIP_IP",
        ]
        admin_username = "admin"
        admin_password = "password"

1. To get outputs into environment variable run this:

        export BIGIPS_ADDRESSES=$(terraform output --json admin_ip | jq -rc .[])

1. To teardown instance(s) run `terraform destroy -auto-approve` cmd:

        Destroy complete! Resources: 1 destroyed.
