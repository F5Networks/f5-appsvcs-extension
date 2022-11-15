#!/bin/bash      
                  
sed -i "/^[ \s]*\"resolved\".*${ARTIFACTORY_URL}/d" ./package-lock.json
