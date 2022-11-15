output "admin_ip" {
  value = "${openstack_compute_instance_v2.openstack-instance.*.access_ip_v4}"
}

output "admin_username" {
  value = var.admin_username
}

output "admin_password" {
  value = module.utils.admin_password
}
