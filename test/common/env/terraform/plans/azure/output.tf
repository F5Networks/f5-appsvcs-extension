output "admin_ip" {
  value = [azurerm_public_ip.pip0.ip_address]
}

output "admin_username" {
  value = var.admin_username
}

output "admin_password" {
  value = module.utils.admin_password
}
