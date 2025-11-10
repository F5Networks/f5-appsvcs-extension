# BIGIP image
variable "bigip_version" {
  description = "BIGIP image to deploy"
  default = "BIGIP-16.1.0-0.0.19"
}

# Run parameters
variable "admin_username" {
  description = "BIGIP fusername"
  default = "admin"
}

variable "nic_count" {
  description = "Number of NICs for BIGIP"
  default = 1
}

variable "bigip_count" {
  description = "Number of BIGIPs to deploy"
  default = 1
}

variable "performance_test" {
  description = "Whether or not this is a performance test"
  default = false
}

# VIO
variable "image_flavor" {
    description = "The image flavor in VIO."
    default = "F5-BIGIP-large"
}

variable "networks" {
  description = "Networks for BIGIP"
  default = {
      1: "AdminNetwork",
      2: "vlan1010",
      3: "vlan1011"
    }
}
