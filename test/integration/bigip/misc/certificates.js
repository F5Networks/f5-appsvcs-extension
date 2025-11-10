/**
 * Copyright 2025 F5, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const assert = chai.assert;

const {
    postDeclaration,
    deleteDeclaration,
    getPath,
    getBigIpVersion,
    GLOBAL_TIMEOUT
} = require('../property/propertiesCommon');
const util = require('../../../../src/lib/util/util');

function getCert(usecase) {
    const cert = {};

    switch (usecase) {
    case 'modified': // For when we need a different cert, use this
        if (util.versionLessThan(getBigIpVersion(), '16.0')) {
            // Use valid X.509 certificates for older F5 versions (case 1)
            cert.certRsaCert = '-----BEGIN CERTIFICATE-----\nMIIDGTCCAgGgAwIBAgIUC3cweY+TzB7MyQrHqccQHtqJquEwDQYJKoZIhvcNAQEL\nBQAwHDEaMBgGA1UEAwwRY2FzZTEuZXhhbXBsZS5jb20wHhcNMjUxMDAyMjExMDUx\nWhcNMjYxMDAyMjExMDUxWjAcMRowGAYDVQQDDBFjYXNlMS5leGFtcGxlLmNvbTCC\nASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANQ/bZxLXlyEMhB8GVJD9hzA\n/WV8m2GxxbrMUFiA06Wc22owmHe8W/eZbjIUfMYIAylm83ZD5eGIQz+ImwK/HABM\nwKAlvtyNAI0SG1m1K65IuakQiYx2JnYrqyLtnDj72aNCWlg+SUb00hR86S/0AsZt\n3ock6qxxzNDKcDtb0Hi/tw8JBsX32rXOdSwuX35NbZDjGKVIPcPFSg5bOjC1zu5F\nr2MN8LVs3gh4nHHJ25tVV+C+C8KnC2dQXW88AJDIgADf8kLTI2RfdB+wkUZggXT+\nFIPtQtUcv17pKIJFQd50iW3tS6KJLuyRAP/eZ6ijZN0lD2e8h6HvPXIWAp4Vog0C\nAwEAAaNTMFEwHQYDVR0OBBYEFAmHChJ0eZ8KCkh0+whtHv184MLYMB8GA1UdIwQY\nMBaAFAmHChJ0eZ8KCkh0+whtHv184MLYMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZI\nhvcNAQELBQADggEBAGUaR5xdaon9OEHVLJibNJAV5oqJE4wNvqHb89mMqDGEl08k\nbjwD0ZIdrNqFf+jcu2xtgA/Em2o6M3x6iP5WACgr3yzZDHNH7/Xk8eRj3Dhhg1EA\nUiqmCoV31X2quiVuWUAzlnTcfmR4ZFCRZqpzMiM76BxWv4H3GTu5Bf/OpSYPnvVT\n2LbhTELeN0+3z/Cs7saUI6Jd+HLcH1py8oXt3Ivtu8w7CIa85WaEoTPaDuOFUW4p\nAAC1qvunPYRrUj6AUOaHl9ba8MyHJ+OJT5LcQIe+NnIaUU1IrSoJEwTSWJem2iPn\nZ/j7wLN0DYA22A5c3oI4oMIvOLELLKx8xEXysPs=\n-----END CERTIFICATE-----';
            cert.certRsaKey = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDUP22cS15chDIQ\nfBlSQ/YcwP1lfJthscW6zFBYgNOlnNtqMJh3vFv3mW4yFHzGCAMpZvN2Q+XhiEM/\niJsCvxwATMCgJb7cjQCNEhtZtSuuSLmpEImMdiZ2K6si7Zw4+9mjQlpYPklG9NIU\nfOkv9ALGbd6HJOqscczQynA7W9B4v7cPCQbF99q1znUsLl9+TW2Q4xilSD3DxUoO\nWzowtc7uRa9jDfC1bN4IeJxxydubVVfgvgvCpwtnUF1vPACQyIAA3/JC0yNkX3Qf\nsJFGYIF0/hSD7ULVHL9e6SiCRUHedIlt7UuiiS7skQD/3meoo2TdJQ9nvIeh7z1y\nFgKeFaINAgMBAAECggEADNsaVvRwuX6vWp9trYrcx3vqt/Y0IiwmpiHLKbqEjKbj\nhRB+97JYHrdI0liP1d3f39GIJHfIiYsw9Dz1vf+Yi63FIB4mgUzlcDtdHpH88erz\n8Jkwv6owul567fFsUZOdqIgebp23311OXpEnUwZ/EYj6SNTJWxsZ1Q63Ur0aXj81\nk7axltu+0ccZlvYuaayoyfj1XqoPNXcOHPklgprRBxSKgkQWqaTwseFbYrkU8PHe\nVWhvscJQ/DX8LLtykK5xgLnwvMyvuZxZ0U+2wYEyL+EbvyOV3oZOv1qCb9v7Rfam\ntUaDQMt9WHPLizHr6ZKCYCQxRdNKlirpQajBJaQouQKBgQDc7YaFZSUR707GOF+p\nk/TZeTBgX9140DUTExbpYI8HzuJ9JL7gu0RjhH0AXg7AyZj3cz4lVTj/DZFlnu4J\n65F0rMB1vltHCgsGa2E0Q+1hTBglWwukj+wjkzEb6IJ4pE/yzheOXrlbE75zVgGy\n2ncGOvk/l1gtlpgxPLXuFjdAWQKBgQD18SViGjYwrF0lh7WfBnbsb5fkJ4JDRTkw\n0ML99B8VjLG8BKBr8Qwu28A9Z8ezuWtLVnFo+GUuYjT16HAERtqxYAOuwDDztMGu\nDMcuoHsssAIMnahKhxvxf51MmYTYYAqQ8XRr5VK3xUBWeJweGjqKFx1dt/euK1aR\no9SduCLY1QKBgA/pS3bwAet4wMOl673a2hePktxeCyVYWXo2NcA5JBP74nQA4X5t\n/k7si9Qq8gUQf+PSePdXW/OClqYq/BnazW8JwhK40voazxB3S1joS4BmapbGJ+CC\nPQ+S2kaYSE1ICDoEfc3TJKZalazY1OZ8tXXNaYYa8E7YOb3SEYhEMVaBAoGBAMDx\nO9ioo5avwittOejWE3oNWeXdsO3BYsqPHEpKuBAZ3l2Ya5oC8wHX2ArUXfD7J9dk\nq3gkVox68v1wKmDQjUTWBE2V7VFjnwZCdAh6UeeO9SyciqhdMmjVKrwrO/Lb9a4c\nHq9+qtQM5RpxaFidTwuCcsFRT/fNfA6prmVFTeE5AoGAQTVugfQNNGPA6isPzMzT\nX6Xq3sAcV8tIOj02S4K/RFW+KFMLgtXLJO9vGKglPMv53UIzBFZOHZmNqDX/FRCA\nXJknOy/QgGaZPCDi19sZUsMqyXwfPZpq+mrQiSyapqF7rlTOlAsQdTUBW1wOpez/\nTzYnFRwvepi4qR4BbUJaV5g=\n-----END PRIVATE KEY-----';
            cert.certEcdsaCert = '-----BEGIN CERTIFICATE-----\nMIIBjTCCATOgAwIBAgIUUo02Rl+JrFH3T37wUPp5CdxzzLQwCgYIKoZIzj0EAwIw\nHDEaMBgGA1UEAwwRY2FzZTEuZXhhbXBsZS5jb20wHhcNMjUxMDAyMjExMTI0WhcN\nMjYxMDAyMjExMTI0WjAcMRowGAYDVQQDDBFjYXNlMS5leGFtcGxlLmNvbTBZMBMG\nByqGSM49AgEGCCqGSM49AwEHA0IABMB5kwUa/ohbrOQeiKFKUNESCo+1Bcem9jQz\n5RGJmhTESYt8T8agkYewpbxZrCAHhi4ViwFUNfIXy3BUUlEmwtajUzBRMB0GA1Ud\nDgQWBBQZ46SdM0KAQocptmIAIJH2vO4nHDAfBgNVHSMEGDAWgBQZ46SdM0KAQocp\ntmIAIJH2vO4nHDAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0gAMEUCIGyc\nKMxx9ED96NHKs9L9swtM4yT0YUXLjlmMdKa+C458AiEA8EFfGjF5EaPiNVYpdlmv\npMBYQGjrkpCNux16Mt1ulfc=\n-----END CERTIFICATE-----';
            cert.certEcdsaKey = '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgnzKkqZfq2DHbWAO4\nxILovQ0hF+ojp3eJIN4J7LK6nKihRANCAATAeZMFGv6IW6zkHoihSlDREgqPtQXH\npvY0M+URiZoUxEmLfE/GoJGHsKW8WawgB4YuFYsBVDXyF8twVFJRJsLW\n-----END PRIVATE KEY-----';
        } else {
            // Use prime256v1 certificates for F5 v16.0+
            cert.certRsaCert = '-----BEGIN CERTIFICATE-----\nMIIDDTCCAfWgAwIBAgIUVkzL7NwzPn+uuijphSCmJJwBeVAwDQYJKoZIhvcNAQELBQAwFjEUMBIGA1UEAwwLZXhhbXBsZS5jb20wHhcNMjUwOTE2MjIzMjQzWhcNMjYwOTE2MjIzMjQzWjAWMRQwEgYDVQQDDAtleGFtcGxlLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMqNpQwokOJjvIiJbc2majqavJr8mUkSgn7jicOqfow8CYTCwTQMFT8kkCdvBZEoNB2bj1QJ1fQyxnKNwulY4hqUebxcfdNOkNfzVATTpejEUlJkS5PuDMqol3DNOIsh90w9mtyl3Lvvb3rya455qiBXOvl/AxSdp1XP3Z2RIQW1xUqUTemEY33uhwoT2o20mxHts//5uzBEss/3CP3O4iGt2xwqcQfsr/K2s0GTmE9w6mDFnKPqOmXhlGQWPAn5uIaER1XEWCs7O0VlqZPnqqCk1SjIqFTLQxEwk5DNYX0nqgEi7Ak/J8vm8OJGG/toQIcy00wiljIgx6cfVcOivbcCAwEAAaNTMFEwHQYDVR0OBBYEFMhiK1igmfuRjMETROcy25qln6vUMB8GA1UdIwQYMBaAFMhiK1igmfuRjMETROcy25qln6vUMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBACD3GVyJKMLcL2yCsWuF0JgH1bo8zceTEAzUK3v2lajTKSAvCQsaduotAYBAgzTtcI69SHCnEnvkI7pLtGT5/NFDCcg1lZDT5Z+JGv9wOeG01aAdVP/t1qN919t10/GJWXhoFOye0MK1hxqj2GPukKrIlGzDpmAJEA6KYN6N4XPVrKWwxAiJnjiMdRn+/c1e8Pw3GWo7iTC0MhNpbkUclFNPlcuWAOiUcy/Sd6b3Su3N8TaZ/2B+7cn4h51P52ilXfIVOI17J07tnLfALSXxdqEf6UyIF6mwSAU1j4ewtxydpa8094edjYNu3lzsqRrmrws3FR/XK70r2Xhcpu+tsKY=\n-----END CERTIFICATE-----';
            cert.certRsaKey = '-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDKjaUMKJDiY7yI\niW3Npmo6mrya/JlJEoJ+44nDqn6MPAmEwsE0DBU/JJAnbwWRKDQdm49UCdX0MsZy\njcLpWOIalHm8XH3TTpDX81QE06XoxFJSZEuT7gzKqJdwzTiLIfdMPZrcpdy77296\n8muOeaogVzr5fwMUnadVz92dkSEFtcVKlE3phGN97ocKE9qNtJsR7bP/+bswRLLP\n9wj9zuIhrdscKnEH7K/ytrNBk5hPcOpgxZyj6jpl4ZRkFjwJ+biGhEdVxFgrOztF\nZamT56qgpNUoyKhUy0MRMJOQzWF9J6oBIuwJPyfL5vDiRhv7aECHMtNMIpYyIMen\nH1XDor23AgMBAAECggEAM0aZPhM03kKuUwgrRlC2+p/6V+fTLBbl9xZF5UUPZRO7\nuyKMQ089v67TWVA3IhCB5O7g4T7eLUP/TbeKXIUWM/FbQe5OIgR1EV31aoVjriGo\nz1e5dDjifxkfwTwKcNpH3sKHpgzM7LyHxaGBzd8JzMcYVFmtX3YrisMk0IMRT37I\n3nGVWGA/0BVXF/CT2zF0OYCfvn8K2RMzFUcl9uTpIaOhmTHhuqN51kxC09eTufNh\ntlBnG+HtVlM9/LAdQ7OsDCiJIbhAJ6ZJElgnXaIZZGGmSlpOU0PTA/8ABDatHHcs\ndK1qwYt7f8p+CZraUYvGn1L2In9Wecr1gqztNXhMPQKBgQDKkToWHZb7eKIkYh4P\nW6ihA7cI84FY+1rXAwCEelEVq/kB+SpE5IRU/x7x/XffBME+hpIhsG42w7Triq5c\n6J95myjQueiCO9y28nwT0gpcMwXtifhQL8tV8DvQ65YVAZjUib5JqCm0mMENeA5o\njN02t7ciCWqsBuvroUfASMdAjQKBgQD/+3kRGu4e9bQXVd380tXwvHUQu+U3q7Bu\nddit0grZQDxTEEqePSxmfz7D5TZLSYMHPolIaWle6KjqrUnQTeyvbQa+y+s8vg3f\no8HVLhRI72vtahwDSIazJr4HMTDj3I64JpPmJJes2A/RUDv58XBRWj+fPwH/Pq5J\nBZyUUwAQUwKBgBTsFRTNr5d/qTeazsIFVJB04sXQ6M44//PvQnFsdM2JOqnig2Qk\nOirRQu/5nxTw18jOe29xWqDba+dcJpBAEqCrzvZoDUTOTAi1WO1vJ1TIjFcxhe06\nUoUoz/TPMGwxAwkIxRe0f8JAeMgcW1ifHAYXyZmBYXwtJtbqjI+mtLXNAoGAUZ48\n29daVUTCRy55uUMAM+Hi8ZL3Yui7OH0auVFfZCW3FkT7hbi7j3LC8HME/LxTqtul\nqhDyJ/DG6wyVnHU8IjMBE5SxTIzMn6H3C6HFlfvAzdInXGSjjjusG17z17NbThv+\nzEKemd3KLVMHzInO5iGAZ6YPXPL/XwkLA7/zJUECgYB/i3G63TiUH+OwySWdbMVx\nQ8yVqZnvpzaRMq9FDrblknJ7g0FmoEZJQZBoVx4mFbkQxfrXymikCO51LWmYzYGU\nJVq3bAJNRjt+8K+tLFA0/7tyOhnKf/AjctxRoujTe9G6OvTqPiCZnKvWqvp30Hg6\nR+pI+MoxDWlJRdighyw6IA==\n-----END PRIVATE KEY-----';
            cert.certEcdsaCert = '-----BEGIN CERTIFICATE-----\nMIIBgjCCASegAwIBAgIUBiAJW81kWBtI4J52Cu7xPY7blXQwCgYIKoZIzj0EAwIw\nFjEUMBIGA1UEAwwLZXhhbXBsZS5jb20wHhcNMjUwOTE2MjIzMTQ5WhcNMjYwOTE2\nMjIzMTQ5WjAWMRQwEgYDVQQDDAtleGFtcGxlLmNvbTBZMBMGByqGSM49AgEGCCqG\nSM49AwEHA0IABECmKbWtoHrfnux3KFlPzkN+A6QOppFTESTREtHAeznTan7LGY7Y\nPnTmPkA7HpVjpp2Y5TZDQbXASZ9q+nLgOdOjUzBRMB0GA1UdDgQWBBTp9Br803hM\nzMUfkVDaH6ta7c+BwjAfBgNVHSMEGDAWgBTp9Br803hMzMUfkVDaH6ta7c+BwjAP\nBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0kAMEYCIQDna+uiQfzhpsqJ6yxI\nr4ME5e2HmznbXS2ByEqAdz8A5QIhANf3N0Oz6+xudeTknD4giGDTp1P7KuXCNWhj\n3DRTVRsU\n-----END CERTIFICATE-----';
            cert.certEcdsaKey = '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgFu30je53VhFU6AHP\nWnmzc0o/WFSn/OOwabSZdgUdHeChRANCAARApim1raB6357sdyhZT85DfgOkDqaR\nUxEk0RLRwHs502p+yxmO2D505j5AOx6VY6admOU2Q0G1wEmfavpy4DnT\n-----END PRIVATE KEY-----';
        }

        break;
    case 'default': // Either explicitly called or not provided, use the default certs
    default:
        if (util.versionLessThan(getBigIpVersion(), '16.0')) {
            // Use valid X.509 certificates for older F5 versions (certificate modification testing)
            cert.certRsaCert = '-----BEGIN CERTIFICATE-----\nMIIDDTCCAfWgAwIBAgIUBTXakcewP9y5pyndEPeSvj9wIWAwDQYJKoZIhvcNAQEL\nBQAwFjEUMBIGA1UEAwwLZXhhbXBsZS5jb20wHhcNMjUxMDAyMjAyMTIwWhcNMjYx\nMDAyMjAyMTIwWjAWMRQwEgYDVQQDDAtleGFtcGxlLmNvbTCCASIwDQYJKoZIhvcN\nAQEBBQADggEPADCCAQoCggEBAJsp7nRR723xDY4qXzAqkyRot7Bk+bjtuujNvn0P\n2TwOTGJrN2L+QSxfUggak9gKGjgvpvzu0T9Z5Y9uhB2bznDNZ78Hq7JiB4Hsr78A\nQ5+6FVngW66N6BWWwGqe/kmoCAgtFtFDaBW3O6U8KX8CwNGoKPspM9+vAnDQmYYv\nSpXwO+qGrB+Ci6zn+5V+E9PkmX2MfM+y7BUrpG86G+BPAgqT9XrSOBc7aEz/7VMB\nCQtQBSxYoKdN1up8rez4UUgTIyZEoDgFL6tMfGuiSxQpqbVFihTcvBQz8erA0bJa\nPB2SUVVskY5/j/oCFXsrWNKjWunSZNpCK7W5+louDEg4+b8CAwEAAaNTMFEwHQYD\nVR0OBBYEFImFnvT0IdV56XXgQ8xKOPTBZxj8MB8GA1UdIwQYMBaAFImFnvT0IdV5\n6XXgQ8xKOPTBZxj8MA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEB\nAGA41a5CFd5JoG3R4+ldTB+7eIQEcfNoXHa4zBcOcCJLz3i7blnEdbDnKzLzMqoF\nkg2+bie+MIcSrD+3AhTTh3v8huLcqzFr+NsADU3D0WBWa7clxGGVR6PYzGyTcnw4\npEDrlSR56UY1lFcyT3KDmI2yp1KLkzVtt9g7AyCg8Q6DvtxZouNufClwZpIP5Lrs\nnBa0vOfgO6bIPKFrpou4YlIGzoKruvTQRmEHT6GSaPxVawoEIX88kTUGRWVszCwo\nBQssZhuJICw2LgzZS4LTIJui6AKLAgCAW90+xBSj8CjqsLoR6SHtQAMPx13qCQei\nKQF/ZAP9hy8cA7zqKxKwvvU=\n-----END CERTIFICATE-----';
            cert.certRsaKey = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCbKe50Ue9t8Q2O\nKl8wKpMkaLewZPm47brozb59D9k8Dkxiazdi/kEsX1IIGpPYCho4L6b87tE/WeWP\nboQdm85wzWe/B6uyYgeB7K+/AEOfuhVZ4FuujegVlsBqnv5JqAgILRbRQ2gVtzul\nPCl/AsDRqCj7KTPfrwJw0JmGL0qV8Dvqhqwfgous5/uVfhPT5Jl9jHzPsuwVK6Rv\nOhvgTwIKk/V60jgXO2hM/+1TAQkLUAUsWKCnTdbqfK3s+FFIEyMmRKA4BS+rTHxr\noksUKam1RYoU3LwUM/HqwNGyWjwdklFVbJGOf4/6AhV7K1jSo1rp0mTaQiu1ufpa\nLgxIOPm/AgMBAAECggEAL6NTE6FoSi/dAo3dxbL8lAwWgXCu/uj2Hq20Uz8/aeHV\n782NJrZ7Gf11+Qj35TdMz31J3pQP6ExYX44Fv/VrD1TxCkR3oX/ZYDljx9dz66E9\nFuf8Hf5xh9dN4i5IUiLlvGTjgYIZfblQ9a0f7F/TBUuEsX/37jAUJsDUsc7pLlkl\n0ExNv8aXLLGOKqUnnN3HzTOUOx+APwjmjxsdnT/GtbCygZu5CkB0YiszeBxF1nT7\nA7L/vkPk0NLhTao4Gg27NcEE1qFI661IIP+sN5xQ598loIFM2w/RU8LzGCcR0ZUM\niuK8/fNBmB+VL35e7CySTWngIYRnWnsgrznE7qOQyQKBgQDVgNPQFzl6gVIh4sSM\n9pUmrp1uO4OnyWCxa/KawkxS0Fkph0WIcW2ICd+1/lQLONzDs+1LTPoYeJCUoQnO\nA59paHPTxJfMloYpic2n3vrVN3SFaHawLVTme234g0gXYt0KP2lT1bUHk8vMp7Fa\n9J1cPjOg7oo2t2JDOjXIiD9cZQKBgQC6DGLyEVB/eauE/FYHi38Mrktepg0Zy1oZ\n6DI1pv6MzkUGA+8T58rQfY4lzqRXKqYG/9sPt2NQ3XyRMQQOSdYFMhAgVphoyBPm\nBTdDgGUJSiXJEgs2VBpD8XOCnXdrS7BNJ9wHwTXrwuJiidDb9Bdx2iVhdwqoh5Rt\ncPv3DOEhUwKBgDmBfYuq9bxdYLXn0nD1aa8FkTnDpe5nezfOj4XHl68mlx1sZfoe\nMxZVMoBehFyRcET2DZAep643qxmdVnq61xEZJTmA1jIwyOofR9lTYdRUH3pfbLh/\nPULnM/OfyKcj5c2AzunZwezMjjQNZuPMxyW1S0qpdWjPdBQPdbURnZ9RAoGBAJ8S\n5ir5OO21tzyekGQlFr1d7V2A9uSeJWzPRtbu8OitmQC6rllDr/qxz69tzsAk3A5S\nBxiaAZXruo1d7ozU/uQ0WOt9fxTgNXtP7F+P0VOvDT2tat7J7Cc5tDzyrF+WOKjP\nsucCgTsSx4PfODBItR8ImTuLkBZmzjcBCr7CSV+3AoGAAcIFhJaBhslJWI+yr6tx\nRaPmKDaa5nlsqGmzOZwDQw7SEwN2DZaG5fsxIMQvLsHRi+csWoqWL/Z6SmkQuJQU\noE/eq9eev4a2jm4I0Srnp5q4aOGR2vbXuNmYN7Omu1pUAGuB27+bJ9yMU/IwY8zN\nI9y2L06LP/JQWQ3L092qwQQ=\n-----END PRIVATE KEY-----';
            cert.certEcdsaCert = '-----BEGIN CERTIFICATE-----\nMIIBgTCCASegAwIBAgIUclmlAu53NXDKOT3yhQ0PxvAd4D0wCgYIKoZIzj0EAwIw\nFjEUMBIGA1UEAwwLZXhhbXBsZS5jb20wHhcNMjUxMDAyMjAyMTQ1WhcNMjYxMDAy\nMjAyMTQ1WjAWMRQwEgYDVQQDDAtleGFtcGxlLmNvbTBZMBMGByqGSM49AgEGCCqG\nSM49AwEHA0IABDfr6ddJx8VJC+MNIyP/78R/08fzMonGTevUsiYlwhEpWjd3bMzu\nCu7dEVtkDH3BNTuDqvXzv8s/w4d//bOYseyjUzBRMB0GA1UdDgQWBBT64xNX0a3m\nANvkyQUbyKmCTTrbCDAfBgNVHSMEGDAWgBT64xNX0a3mANvkyQUbyKmCTTrbCDAP\nBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0gAMEUCIQDNWoiYJ9IB9HoMvkUH\ncRKKIx6ng+8Xm8j0d/Fdl1m6EQIgS0uhwwcdPJZennLtgL0zYqCY8v57kuALB1Es\nQCr0RBU=\n-----END CERTIFICATE-----';
            cert.certEcdsaKey = '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgfC0tiDjwpZ67/ftJ\nDqs2l+3QWgU9fNRKfm3+hAiRRsWhRANCAAQ36+nXScfFSQvjDSMj/+/Ef9PH8zKJ\nxk3r1LImJcIRKVo3d2zM7gru3RFbZAx9wTU7g6r187/LP8OHf/2zmLHs\n-----END PRIVATE KEY-----';
        } else {
            // Use current certificates for F5 v16.0+
            cert.certRsaCert = '-----BEGIN CERTIFICATE-----\nMIIC/zCCAeegAwIBAgIJAORJGvs8YNr7MA0GCSqGSIb3DQEBCwUAMBYxFDASBgNV\nBAMMC2V4YW1wbGUuY29tMB4XDTI1MDcyNDEzMTE0M1oXDTI2MDcyNDEzMTE0M1ow\nFjEUMBIGA1UEAwwLZXhhbXBsZS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAw\nggEKAoIBAQCrYTIRCP1SOBFouFnewYBpkD3fWMBZGJu270CHLUk3aVp2q0zm8qJi\nGte7BfrAJrDeDzpOPp4/CI3iVYwYscgy2tNa/pwzTmQIRjGWJLv/9ramAuhllExn\n66dHhhKkhCjJA1TgnSQV6dxBhCDYxdogql0ny/ok2qvxgnXvO9EGrcmLoVte5i0j\nl2Zcf+kon1GCNKf70rWLJdhTFNpG4oifrCWAgPXKpf9XCaa+8NDlX3L8FdF+M6P+\nrnkqO7z6Q/6H8bxvv2slxCWqaGMCp/j0Ty2AhYfVMy/em+KAygJt7Zig10kx4sZw\nXFvkJA0LgiJMLyl3UfliYyMqI4PJaX0PAgMBAAGjUDBOMB0GA1UdDgQWBBQQBds4\n0eZsSjyctu+C9AccSJQlhTAfBgNVHSMEGDAWgBQQBds40eZsSjyctu+C9AccSJQl\nhTAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAGzfXFqZwNUnI16AUm\n8iog6s+MCFwMCyhRvY0bp0yZ3VQyerT1KFB2go0opqgCcC/rCqeiTeKWInDPvmCY\n+sIBoVQ44Pp8fNBXloBuxA1B6HQonR0hJaa27ly0qfzsn2qum0B5W/6aFUlpJ2fJ\nwwnlT09NoaLBoQxID/KrvAjMZDrpAoo0V23G79W7u5YhNOkhx2zSBuE5Zw8q4Dpv\nMVE/waxVvLj6leP05b+ihrUEezNOco51OkYBBkiFBUkhW7SfqKDp87bJW7qNbhkg\ntPJVAvf9debN2CwwmMgI0oiLPMirIXAWwMrfeUExF8vL4+nAbpb1+qdf6O5SD3Or\n95qA\n-----END CERTIFICATE-----';
            cert.certRsaKey = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCrYTIRCP1SOBFo\nuFnewYBpkD3fWMBZGJu270CHLUk3aVp2q0zm8qJiGte7BfrAJrDeDzpOPp4/CI3i\nVYwYscgy2tNa/pwzTmQIRjGWJLv/9ramAuhllExn66dHhhKkhCjJA1TgnSQV6dxB\nhCDYxdogql0ny/ok2qvxgnXvO9EGrcmLoVte5i0jl2Zcf+kon1GCNKf70rWLJdhT\nFNpG4oifrCWAgPXKpf9XCaa+8NDlX3L8FdF+M6P+rnkqO7z6Q/6H8bxvv2slxCWq\naGMCp/j0Ty2AhYfVMy/em+KAygJt7Zig10kx4sZwXFvkJA0LgiJMLyl3UfliYyMq\nI4PJaX0PAgMBAAECggEARNKzBvlLtc1zXFEQMi8WEQ6OcleTYxRJUDUTflWW3gxO\nenJ/Xw2YXXp3IRGdKbY/9+U4nnxyE1EtnXOKX85hXd7X2uZ9tvLnpBUAS9Hzt66N\nmex4BHcCGgeeNVBnwy6ZrGPMnakteSlhvOPBRxxpZQ3VfCpjiZJRU5r3HnwwjJPs\nUwVyqeMDZzY3SFl/pvcq2QSJ30r1hvZ66RvZqng1EJvjFPHoStNB2QSjpmy732T6\nARmi2Bfhga9yAn2708lA1C+Knlow8FZIqp0gtQAWTgo8ASLV1twPIgV26L6+gQD0\n1PZ+Rcde/enPJ8+VKLHlq1eAn3q+jlGrwXp38INz+QKBgQDfdSGr/bkI/FmkpcWZ\n/ciQTEohDa2/8+Q4YCqISw5dVnsnQesSN9oDhVFb4NqJbbhhadw3fHrpLbqYRo7g\nrlM+VX1OucM7wlMzO9/sBPJyr+xKoupN1+mKlMsjzAaDC91dO+WBRMRAOtniR+zz\nXLX/2h6i3xFqBlft+wT6WW3FVwKBgQDEVoOtHCWf0fVoRzvzXoAvruWSfg/TBtbr\nvaSTMzrqP4SybJWnOFIWjlnP/tbGCKoG0Tc20rpw08EmeNiax76wjUMwAjonKftN\nxO9kjWI6rqiAe7Ipu9Nyt4Z4YznBifCLBTLNvEiPzA0ubdglSg3o6vM0PcSgwrII\n5oPJNnG7CQKBgARSy9f8DLxzxXg+DNix5FOGZljFXvs7yMqecbQ5X4nGxpM330h2\n9CzlQ3G3pALMsKiR18TrD6W7UMTpeJI4TTwDg20mgvSBCgMPwYFbhyVY6gV3qXjg\nGJCp2FRU+jtG232WTxZ1Mibb/KM4KQl8XbkZi0Yzcq7OeJ0OIkaFvG35AoGAaGC6\nBhjVo76CIdrk80AFE9R+NcAQ95ZGQfOC/8KXipsUF6sEcG7PrTAmbR5E3ekTQyaM\nnPewqHTa1XIfbUHNjZy74FT+x31ZHYIZ5rIHS7041X1tPSSeh/krYusVdF+54p5z\n4M49IT1QsKMy6rgQ5wepHdfMpc57yaGK5Diug8kCgYEA2DPvCLr5ATKrpePVuMgw\n3WIb/m/dd47tGSL1M+x739VthRkhNpZVK9T5t4/H5Sf/fv5/VZ6E7Er2CsPIgJrB\n/n21A3Hdj3C9DQrYmSzfC3D7j2V0mcZaaGYPvQSQpbBkGhqNmadeZwokGW1HD640\nCUme8qv3ZCx28kTttYkAt9Y=\n-----END PRIVATE KEY-----';
            cert.certEcdsaCert = '-----BEGIN CERTIFICATE-----\nMIICaDCCAg2gAwIBAgIJAP13qQYRz0CPMAoGCCqGSM49BAMCMBYxFDASBgNVBAMM\nC2V4YW1wbGUuY29tMB4XDTI1MDcyNDEzMTIwMloXDTI2MDcyNDEzMTIwMlowFjEU\nMBIGA1UEAwwLZXhhbXBsZS5jb20wggFLMIIBAwYHKoZIzj0CATCB9wIBATAsBgcq\nhkjOPQEBAiEA/////wAAAAEAAAAAAAAAAAAAAAD///////////////8wWwQg////\n/wAAAAEAAAAAAAAAAAAAAAD///////////////wEIFrGNdiqOpPns+u9VXaYhrxl\nHQawzFOw9jvOPD4n0mBLAxUAxJ02CIbnBJNqZnjhE50mt4GffpAEQQRrF9Hy4SxC\nR/i85uVjpEDydwN9gS3rM6D0oTlF2JjClk/jQuL+Gn+bjufrSnwPnhYrzjNXazFe\nzsu2QGg3v1H1AiEA/////wAAAAD//////////7zm+q2nF56E87nKwvxjJVECAQED\nQgAEiiAyU5TVP/RHNVCUptrdC76GF1qIy0rid41QQUiL8GLq1IBmIJznMZC5To0D\nnH6RkBXLBx0gM6Gpv0vvbQ996aNQME4wHQYDVR0OBBYEFBYFj/M+v2+nxH0zPrGF\nQfbwvDiVMB8GA1UdIwQYMBaAFBYFj/M+v2+nxH0zPrGFQfbwvDiVMAwGA1UdEwQF\nMAMBAf8wCgYIKoZIzj0EAwIDSQAwRgIhAJiQGYNiJGSFzvc0Eyf5ikb6pCMqvmWC\nTITvMQP4OkASAiEAi2ZqngIfpC/c/699/wgLkH8gYU6K7jeonzOS1k7N8hY=\n-----END CERTIFICATE-----';
            cert.certEcdsaKey = '-----BEGIN PRIVATE KEY-----\nMIIBeQIBADCCAQMGByqGSM49AgEwgfcCAQEwLAYHKoZIzj0BAQIhAP////8AAAAB\nAAAAAAAAAAAAAAAA////////////////MFsEIP////8AAAABAAAAAAAAAAAAAAAA\n///////////////8BCBaxjXYqjqT57PrvVV2mIa8ZR0GsMxTsPY7zjw+J9JgSwMV\nAMSdNgiG5wSTamZ44ROdJreBn36QBEEEaxfR8uEsQkf4vOblY6RA8ncDfYEt6zOg\n9KE5RdiYwpZP40Li/hp/m47n60p8D54WK84zV2sxXs7LtkBoN79R9QIhAP////8A\nAAAA//////////+85vqtpxeehPO5ysL8YyVRAgEBBG0wawIBAQQgLScB0Krj24t/\na/YLAV1CW7LGhGO8TS4i3QpldBZ4xXKhRANCAASKIDJTlNU/9Ec1UJSm2t0LvoYX\nWojLSuJ3jVBBSIvwYurUgGYgnOcxkLlOjQOcfpGQFcsHHSAzoam/S+9tD33p\n-----END PRIVATE KEY-----';
        }
    }

    return cert;
}

describe('certificates', function () {
    this.timeout(GLOBAL_TIMEOUT);

    it('should allow references to certificates in Common Shared that use bigip pointers', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    cert: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        }
                    }
                }
            },
            tenant: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    tlsServer: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: '/Common/Shared/cert'
                            }
                        ]
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => postDeclaration(declaration), { declarationIndex: 1 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .finally(() => deleteDeclaration());
    });

    it('should handle declaration with reference to chainCA in Common Shared', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.0.0',
            Common: {
                class: 'Tenant',
                Shared: {
                    class: 'Application',
                    template: 'shared',
                    ca_bundle: {
                        bundle: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----',
                        class: 'CA_Bundle'
                    }
                }
            },
            t1: {
                class: 'Tenant',
                t1a1: {
                    class: 'Application',
                    useCert: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIICnDCCAgWgAwIBAgIJAJ5n2b0OCEjwMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMRQwEgYDVQQKDAtmNV9OZXR3b3JrczEbMBkGA1UEAwwSc2FtcGxlLmV4YW1wbGUubmV0MB4XDTE3MTEyNjE5NTAyNFoXDTE4MDIyNTE5NTAyNFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxFDASBgNVBAoMC2Y1X05ldHdvcmtzMRswGQYDVQQDDBJzYW1wbGUuZXhhbXBsZS5uZXQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBALEsuXmSXVQpYjrZPW+WiTBjn491mwZYT7Q92V1HlSBtM6WdWlK1aZN5sovfKtOX7Yrm8xa+e4o/zJ2QYLyyv5O+t2EGN/4qUEjEAPY9mwJdfzRQy6Hyzm84J0QkTuUJ/EjNuPji3D0QJRALUTzu1UqqDCEtiN9OGyXEkh7uvb7BAgMBAAGjUDBOMB0GA1UdDgQWBBSVHPNrGWrjWyZvckQxFYWO59FRFjAfBgNVHSMEGDAWgBSVHPNrGWrjWyZvckQxFYWO59FRFjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4GBAJeJ9SEckEwPhkXOm+IuqfbUS/RcziifBCTmVyE+Fa/j9pKSYTgiEBNdbJeBEa+gPMlQtbV7Y2dy8TKx/8axVBHiXC5geDML7caxOrAyHYBpnx690xJTh5OIORBBM/a/NvaR+P3CoVebr/NPRh9oRNxnntnqvqD7SW0U3ZPe3tJc\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,D8FFCE6B255601587CB54EC29B737D31\n\nkv4Fc3Jn0Ujkj0yRjt+gQQfBLSNF2aRLUENXnlr7Xpzqu0Ahr3jS1bAAnd8IWnsR\nyILqVmKsYF2DoHh0tWiEAQ7/y/fe5DTFhK7N4Wml6kp2yVMkP6KC4ssyYPw27kjK\nDBwBZ5O8Ioej08A5sgsLCmglbmtSPHJUn14pQnMTmLOpEtOsu6S+2ibPgSNpdg0b\nCAJNG/KHe+Vkx59qNDyDeKb7FZOlsX30+y67zUq9GQqJEDuysPJ2BUNP0IJXAjst\nFIt1qNoZew+5KDYs7u/lPxcMGTirUhgI84Jy4WcDvSOsP/tKlxj04TbIE3epmSKy\n+TihHkwY7ngIGtcm3Sfqk5jz2RXoj1/Ac3SW8kVTYaOUogBhn7zAq4Wju6Et4hQG\nRGapsJp1aCeZ/a4RCDTxspcKoMaRa97/URQb0hBRGx3DGUhzpmX9zl7JI2Xa5D3R\nmdBXtjLKYJTdIMdd27prBEKhMUpae2rz5Mw4J907wZeBq/wu+zp8LAnecfTe2nGY\nE32x1U7gSEdYOGqnwxsOexb1jKgCa67Nw9TmcMPV8zmH7R9qdvgxAbAtwBl1F9OS\nfcGaC7epf1AjJLtaX7krWmzgASHl28Ynh9lmGMdv+5QYMZvKG0LOg/n3m8uJ6sKy\nIzzvaJswwn0j5P5+czyoV5CvvdCfKnNb+3jUEN8I0PPwjBGKr4B1ojwhogTM248V\nHR69D6TxFVMfGpyJhCPkbGEGbpEpcffpgKuC/mEtMqyDQXJNaV5HO6HgAJ9F1P6v\n5ehHHTMRvzCCFiwndHdlMXUjqSNjww6me6dr6LiAPbejdzhL2vWx1YqebOcwQx3G\n-----END RSA PRIVATE KEY-----',
                        chainCA: {
                            use: '/Common/Shared/ca_bundle'
                        },
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0'
                        }
                    },
                    stringCert: {
                        class: 'Certificate',
                        certificate: '-----BEGIN CERTIFICATE-----\nMIICnDCCAgWgAwIBAgIJAJ5n2b0OCEjwMA0GCSqGSIb3DQEBCwUAMGcxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMRQwEgYDVQQKDAtmNV9OZXR3b3JrczEbMBkGA1UEAwwSc2FtcGxlLmV4YW1wbGUubmV0MB4XDTE3MTEyNjE5NTAyNFoXDTE4MDIyNTE5NTAyNFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxFDASBgNVBAoMC2Y1X05ldHdvcmtzMRswGQYDVQQDDBJzYW1wbGUuZXhhbXBsZS5uZXQwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBALEsuXmSXVQpYjrZPW+WiTBjn491mwZYT7Q92V1HlSBtM6WdWlK1aZN5sovfKtOX7Yrm8xa+e4o/zJ2QYLyyv5O+t2EGN/4qUEjEAPY9mwJdfzRQy6Hyzm84J0QkTuUJ/EjNuPji3D0QJRALUTzu1UqqDCEtiN9OGyXEkh7uvb7BAgMBAAGjUDBOMB0GA1UdDgQWBBSVHPNrGWrjWyZvckQxFYWO59FRFjAfBgNVHSMEGDAWgBSVHPNrGWrjWyZvckQxFYWO59FRFjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4GBAJeJ9SEckEwPhkXOm+IuqfbUS/RcziifBCTmVyE+Fa/j9pKSYTgiEBNdbJeBEa+gPMlQtbV7Y2dy8TKx/8axVBHiXC5geDML7caxOrAyHYBpnx690xJTh5OIORBBM/a/NvaR+P3CoVebr/NPRh9oRNxnntnqvqD7SW0U3ZPe3tJc\n-----END CERTIFICATE-----',
                        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-256-CBC,D8FFCE6B255601587CB54EC29B737D31\n\nkv4Fc3Jn0Ujkj0yRjt+gQQfBLSNF2aRLUENXnlr7Xpzqu0Ahr3jS1bAAnd8IWnsR\nyILqVmKsYF2DoHh0tWiEAQ7/y/fe5DTFhK7N4Wml6kp2yVMkP6KC4ssyYPw27kjK\nDBwBZ5O8Ioej08A5sgsLCmglbmtSPHJUn14pQnMTmLOpEtOsu6S+2ibPgSNpdg0b\nCAJNG/KHe+Vkx59qNDyDeKb7FZOlsX30+y67zUq9GQqJEDuysPJ2BUNP0IJXAjst\nFIt1qNoZew+5KDYs7u/lPxcMGTirUhgI84Jy4WcDvSOsP/tKlxj04TbIE3epmSKy\n+TihHkwY7ngIGtcm3Sfqk5jz2RXoj1/Ac3SW8kVTYaOUogBhn7zAq4Wju6Et4hQG\nRGapsJp1aCeZ/a4RCDTxspcKoMaRa97/URQb0hBRGx3DGUhzpmX9zl7JI2Xa5D3R\nmdBXtjLKYJTdIMdd27prBEKhMUpae2rz5Mw4J907wZeBq/wu+zp8LAnecfTe2nGY\nE32x1U7gSEdYOGqnwxsOexb1jKgCa67Nw9TmcMPV8zmH7R9qdvgxAbAtwBl1F9OS\nfcGaC7epf1AjJLtaX7krWmzgASHl28Ynh9lmGMdv+5QYMZvKG0LOg/n3m8uJ6sKy\nIzzvaJswwn0j5P5+czyoV5CvvdCfKnNb+3jUEN8I0PPwjBGKr4B1ojwhogTM248V\nHR69D6TxFVMfGpyJhCPkbGEGbpEpcffpgKuC/mEtMqyDQXJNaV5HO6HgAJ9F1P6v\n5ehHHTMRvzCCFiwndHdlMXUjqSNjww6me6dr6LiAPbejdzhL2vWx1YqebOcwQx3G\n-----END RSA PRIVATE KEY-----',
                        chainCA: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----',
                        passphrase: {
                            ciphertext: 'ZjVmNQ==',
                            protected: 'eyJhbGciOiJkaXIiLCJlbmMiOiJub25lIn0'
                        }
                    },
                    tlsClientWithUse: {
                        class: 'TLS_Client',
                        clientCertificate: 'useCert'
                    },
                    tlsServerWithString: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'stringCert'
                            }
                        ]
                    },
                    poolPool: {
                        class: 'Pool',
                        members: [
                            {
                                serverAddresses: [
                                    '192.0.2.1'
                                ],
                                servicePort: 8181
                            }
                        ]
                    },
                    httpsVirtual: {
                        class: 'Service_HTTPS',
                        redirect80: false,
                        clientTLS: 'tlsClientWithUse',
                        serverTLS: 'tlsServerWithString',
                        snat: 'self',
                        pool: 'poolPool',
                        virtualAddresses: [
                            '192.0.2.2'
                        ],
                        virtualPort: 443
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .finally(() => deleteDeclaration());
    });

    it('should encrypt the private key if passphrase/bigip/url not set under class certificate', () => {
        const declaration = {
            action: 'deploy',
            class: 'AS3',
            persist: true,
            declaration: {
                class: 'ADC',
                id: 't1a1-0001',
                schemaVersion: '3.30.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        ca_example_bundle: {
                            bundle: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----',
                            class: 'CA_Bundle'
                        }
                    }
                },
                exampleTenant1: {
                    class: 'Tenant',
                    exampleApp: {
                        class: 'Application',
                        httpsVirtual: {
                            class: 'Service_HTTPS',
                            redirect80: false,
                            clientTLS: 'as3_tls_client',
                            serverTLS: 'as3_tls_server',
                            snat: 'self',
                            pool: 'poolPool',
                            virtualAddresses: [
                                '1.1.1.2'
                            ],
                            virtualPort: 443
                        },
                        useCert: {
                            class: 'Certificate',
                            certificate: '-----BEGIN CERTIFICATE-----\nMIIDeTCCAmGgAwIBAgIJAM6s50VhmehaMA0GCSqGSIb3DQEBCwUAMFMxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJNQTEPMA0GA1UEBwwGQm9zdG9uMQswCQYDVQQKDAJG\nNTELMAkGA1UECwwCRVMxDDAKBgNVBAMMA0FTMzAeFw0yNDAzMTkxNjM0MTNaFw0y\nNTAzMTkxNjM0MTNaMFMxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJNQTEPMA0GA1UE\nBwwGQm9zdG9uMQswCQYDVQQKDAJGNTELMAkGA1UECwwCRVMxDDAKBgNVBAMMA0FT\nMzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKKNG4uPUEM8WtosRCw/\nJj7o39exnqa6hlPoCexbyh2p1AtJXZEQotrRojXbEkzwKbVpXSfAuXpN8AXoyDA4\nn37bHafC3gc+kaa+bjdS8K0zNDRe0mfIN4s9oBq41czjHGLdXW2PgaIXqOBgB1Yb\n8IkjgcwdhRb2wNN7pzJBzwcqDYOCJHXh0mDc6PDNV8nwwZjuPrksWKZ2UbuyEjCU\ns3J0R04mApHpMGdSlDQVCSCXcOFXYohGe7OI8i9QWKko+clYkHslTrjreq7d2D1I\nAmW4TlJvA9A4BO2F0w+jpizhBuv2G0J0fiZI6XwRQk9lZ9qOZhxVRY/o6untr301\njm0CAwEAAaNQME4wHQYDVR0OBBYEFFF36jdkUOriWBFdkjWygjtQk7ZZMB8GA1Ud\nIwQYMBaAFFF36jdkUOriWBFdkjWygjtQk7ZZMAwGA1UdEwQFMAMBAf8wDQYJKoZI\nhvcNAQELBQADggEBAELqKjYIrDmiWbSSIQN4Yjk6rmVvXzqc+QZQ3qdhE9PDC9Ov\nTe5e1Y+2YBjI1HbF6lc+nLRQfyTkBpY5eo8KtcPiUkJUxGpVYtg+zttNn1OXUu3a\nAU4w2u5NNklsSrZwGwwtQFXXZIcd3Ov5jaq/penvcjjModJtuA4qX2K26tkDJdE7\nfDkMWkbr6e1yxeofcmy2kYM9r7ayAEP8mVlBeeBoWKtgIzW9AXe7vLZmkBTylGTU\nEWAQSfVkVUirWDDwlZU7ru0y2SyxILRVxzrFsknsGkxHmJWjNH9Bh2RjFqulXFhz\nVuTVC6t7OW9oOTeX3FivB7mOlqTYdIF4tvkS6pM=\n-----END CERTIFICATE-----',
                            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCijRuLj1BDPFra\nLEQsPyY+6N/XsZ6muoZT6AnsW8odqdQLSV2REKLa0aI12xJM8Cm1aV0nwLl6TfAF\n6MgwOJ9+2x2nwt4HPpGmvm43UvCtMzQ0XtJnyDeLPaAauNXM4xxi3V1tj4GiF6jg\nYAdWG/CJI4HMHYUW9sDTe6cyQc8HKg2DgiR14dJg3OjwzVfJ8MGY7j65LFimdlG7\nshIwlLNydEdOJgKR6TBnUpQ0FQkgl3DhV2KIRnuziPIvUFipKPnJWJB7JU6463qu\n3dg9SAJluE5SbwPQOATthdMPo6Ys4Qbr9htCdH4mSOl8EUJPZWfajmYcVUWP6Orp\n7a99NY5tAgMBAAECggEAH4GvxNt0oG+eoXqihRwBXwC2wGFAYcs2FaXcZIh/EsRT\n4hMolGFP2491/C/X6ntDblL7mCSyHrtkClUuFjCnc4hnhViPPgK56wKurMEB/uQ1\nmnAFotGLOI0rjvpkEGg13JDRFtcRtpgU5taeHWnhc8di1WwkW4jc47DsPaDFTrsg\nGp8l6oU0D6Z0X9mkGLKwEpQ8kPK9r34RsDuu6GLAVfTJaUQqYSNe8ycBblZISYtG\nM2/EmbKgCIf4rS5QCThhrPYsySMmHtCaSDq+zXZ4qqqGLdA8ua69D5cZFcLWh508\n4ewQ0I9DgRTdUBPwaqU7MDSxRCnVmjbWUp71W9KAYQKBgQDMBpNRT04y+UkUK0xJ\nhPaMQcyfjlONQ/1yKtsu7nRQ0NiJ/Ij+Ri4D7WXUe/oI06PppvLXR+kwxnuMAWnF\nyE6hPC1egHd0ZnBbpx1jgLfCEJz2dCZ9peEzY+9Tib+Ch9vrD057KAWaRMyxcCAS\ncOy1/1/lVMJQ6xC0LyXW1ElnjQKBgQDL9cvQI7KH52sfEJq6Eq32svfH7F78gNAF\nlWWHVWEtmWYGKUKd9lZcbNOAGp6jig8wQMl1vmMsODVQMG4b8a1pXgnkay9peb1g\nrrRmFMDHA1ELWaWyOgyZiQ+KDQJgz26MzUOOLK4jsZgQBhKPh3UYgeFsSB+rXwpa\nn4cpB6UaYQKBgQDJ8Wg3fuvEAIKY+BJWYsk2IprLAzEoDjf6nPi+B0ASDeWHDvL5\n27UIJh44p03hFrqTNq/+7iqeIJeBCJUNMyrA5LNzamzSReLIlSy9pFY+O/tg5a6D\nh4DUQQJOCXYJWTgP/eKMfByviZGhv32/Qw7JRbBBahe7yC+MaW5mqVDOsQKBgQCn\nNK9MyCcRUT+5bORbzPp+94M4i+fm+zcOjMZ6Jx2Ow2YngOXTF+L+zFyrdac+DO2c\nslA2TcmBs+bJAZsTH5L5gZV8g/6ParU9MJxF35eWz3o+YtT7AqnXqMxrcXTUptlL\nZu+N+8UbD/nIkSHgNr1hRQDnw0zrMfQMDSJCGblZoQKBgAVhp9NbrI7VRM+rf8VG\nNxy+4tGhb+kfWjagTEFcL61+4/7tHUyuaThzy/EFFwqqatIiBBFIPZyoNFZi5aQo\n3fI4Cy9W8RlCp8iM0ToAVys3z6LbBG4PJZBvHKNsPOY/30f5nlc6W20YJ+EWnumL\nWjNUPjCq+ZxGqVpEbbBzzaxy\n-----END RSA PRIVATE KEY-----', // gitleaks:allow
                            chainCA: {
                                use: '/Common/Shared/ca_example_bundle'
                            }
                        },
                        as3_tls_client: {
                            class: 'TLS_Client',
                            clientCertificate: 'useCert'
                        },
                        as3_tls_server: {
                            class: 'TLS_Server',
                            certificates: [
                                {
                                    certificate: 'useCert'
                                }
                            ]
                        },
                        poolPool: {
                            class: 'Pool',
                            members: [
                                {
                                    serverAddresses: [
                                        '192.0.2.1'
                                    ],
                                    servicePort: 443
                                }
                            ]
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                const requestPrivateKey = declaration.declaration.exampleTenant1.exampleApp.useCert.privateKey;
                const responsePrivateKey = response.exampleTenant1.exampleApp.useCert.privateKey;
                assert.notEqual(responsePrivateKey, requestPrivateKey);
            })
            .finally(() => deleteDeclaration());
    });

    it('should create multiple TLS profiles with a single declaration listing', () => {
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.53.0',
            testTLSProfileTenant: {
                class: 'Tenant',
                testTLSProfileApp: {
                    class: 'Application',
                    template: 'https',
                    serviceMain: {
                        class: 'Service_HTTPS',
                        virtualAddresses: ['1.1.1.1'],
                        shareAddresses: true,
                        serverTLS: 'clnt_ssl_profile',
                        clientTLS: [
                            {
                                use: 'sni1_srv_ssl_profile'
                            },
                            {
                                use: 'sni2_srv_ssl_profile'
                            }
                        ]
                    },
                    cert: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    clnt_ssl_profile: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                certificate: 'cert'
                            }
                        ]
                    },
                    sni1_srv_ssl_profile: {
                        class: 'TLS_Client',
                        sniDefault: true
                    },
                    sni2_srv_ssl_profile: {
                        class: 'TLS_Client'
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~testTLSProfileTenant~testTLSProfileApp~clnt_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'clnt_ssl_profile');
                assert.strictEqual(response.fullPath, '/testTLSProfileTenant/testTLSProfileApp/clnt_ssl_profile');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/server-ssl/~testTLSProfileTenant~testTLSProfileApp~sni1_srv_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'sni1_srv_ssl_profile');
                assert.strictEqual(response.fullPath, '/testTLSProfileTenant/testTLSProfileApp/sni1_srv_ssl_profile');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/server-ssl/~testTLSProfileTenant~testTLSProfileApp~sni2_srv_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'sni2_srv_ssl_profile');
                assert.strictEqual(response.fullPath, '/testTLSProfileTenant/testTLSProfileApp/sni2_srv_ssl_profile');
            })
            .finally(() => deleteDeclaration());
    });

    it('contains multiple tenant one with encrypted private key with passphrase another has plain private key', () => {
        const declaration = {
            action: 'deploy',
            class: 'AS3',
            persist: true,
            declaration: {
                class: 'ADC',
                id: 't1a1-0001',
                schemaVersion: '3.30.0',
                Common: {
                    class: 'Tenant',
                    Shared: {
                        class: 'Application',
                        template: 'shared',
                        ca_example_bundle: {
                            bundle: '-----BEGIN CERTIFICATE-----\nMIID9TCCAt2gAwIBAgIJALxQA/NW2bpRMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTELMAkGA1UECgwCRjUxDTALBgNVBAsMBFRlc3QxFzAVBgNVBAMMDnRlc3RfQ0FfYnVuZGxlMSUwIwYJKoZIhvcNAQkBFhZzb21lYm9keUBzb21ld2hlcmUub3JnMB4XDTE4MDIyNzE5MjEyNVoXDTE4MDMyOTE5MjEyNVowgZAxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMQswCQYDVQQKDAJGNTENMAsGA1UECwwEVGVzdDEXMBUGA1UEAwwOdGVzdF9DQV9idW5kbGUxJTAjBgkqhkiG9w0BCQEWFnNvbWVib2R5QHNvbWV3aGVyZS5vcmcwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCjhUZmbwwuMMFTNic73t0mfJ/pyM3BnEs0riv6lbrF5znFKBlAM2pxWBfkQvr92gUwitij7BqMagnR26/C7GcJJNJQGNK482vgSPhUpGeN0t4W71Dv5SpwJN+0do6gV0eXPwvcgA/XZxXqZAePwXTp36YMrNTgw49OWZpHoNXfYCZ+1KUL032RdQ/Ik2wO/UwV0csL1Rwuu2L8/NI9VtrThCAr8dsMsDJ53jDh7xQdP3K2V9NYtAHk66697kk7TpzR1moqTJxSVaPKo2eDuKNke1BRbjYWoamu0hfC5YG6l5P9i8QaVklbtmDcmoLpU9fLVSSW6CWHkrtdifQiCOChAgMBAAGjUDBOMB0GA1UdDgQWBBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAfBgNVHSMEGDAWgBRv7/Q0VoBgDYzgJOKLz4GsgXP27zAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQA9r6+6hGVlQ188l+wLFJ1wI83y27BdtE0ZsZGdFv98qi9kcUm17Z0tprEwypODZ1/syt9b1JhD4RgU30qwgeF4kec8UpoG49UkQImRD3AqfsiYSdjZeBpcpEl3n8lkjKGoVY7GB2lMGoWDxv/1A0CSjVTmWgQSFGHoMtzOW1tCr9yGXVEdy691l7PVC1kK5ekwkO8YbSO6hvV/u83KuUiGcIoY1PIzAK301i9YXWUNxybIVfHregoQ11QzjhfdfpOLBTtW1B4QZqZz8qFGIr1remmQK3ljEcct9bWjMLOx2QYMvk6uRFzh+V5L2UnhldNy5wQYMXRDz6SU3LdTJ2OA\n-----END CERTIFICATE-----',
                            class: 'CA_Bundle'
                        }
                    }
                },
                exampleTenant1: {
                    class: 'Tenant',
                    exampleApp: {
                        class: 'Application',
                        httpsVirtual: {
                            class: 'Service_HTTPS',
                            redirect80: false,
                            clientTLS: 'as3_tls_client',
                            serverTLS: 'as3_tls_server',
                            snat: 'self',
                            pool: 'poolPool',
                            virtualAddresses: [
                                '1.1.1.2'
                            ],
                            virtualPort: 443
                        },
                        useCert: {
                            class: 'Certificate',
                            certificate: '-----BEGIN CERTIFICATE-----\nMIIDeTCCAmGgAwIBAgIJAM6s50VhmehaMA0GCSqGSIb3DQEBCwUAMFMxCzAJBgNV\nBAYTAlVTMQswCQYDVQQIDAJNQTEPMA0GA1UEBwwGQm9zdG9uMQswCQYDVQQKDAJG\nNTELMAkGA1UECwwCRVMxDDAKBgNVBAMMA0FTMzAeFw0yNDAzMTkxNjM0MTNaFw0y\nNTAzMTkxNjM0MTNaMFMxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJNQTEPMA0GA1UE\nBwwGQm9zdG9uMQswCQYDVQQKDAJGNTELMAkGA1UECwwCRVMxDDAKBgNVBAMMA0FT\nMzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKKNG4uPUEM8WtosRCw/\nJj7o39exnqa6hlPoCexbyh2p1AtJXZEQotrRojXbEkzwKbVpXSfAuXpN8AXoyDA4\nn37bHafC3gc+kaa+bjdS8K0zNDRe0mfIN4s9oBq41czjHGLdXW2PgaIXqOBgB1Yb\n8IkjgcwdhRb2wNN7pzJBzwcqDYOCJHXh0mDc6PDNV8nwwZjuPrksWKZ2UbuyEjCU\ns3J0R04mApHpMGdSlDQVCSCXcOFXYohGe7OI8i9QWKko+clYkHslTrjreq7d2D1I\nAmW4TlJvA9A4BO2F0w+jpizhBuv2G0J0fiZI6XwRQk9lZ9qOZhxVRY/o6untr301\njm0CAwEAAaNQME4wHQYDVR0OBBYEFFF36jdkUOriWBFdkjWygjtQk7ZZMB8GA1Ud\nIwQYMBaAFFF36jdkUOriWBFdkjWygjtQk7ZZMAwGA1UdEwQFMAMBAf8wDQYJKoZI\nhvcNAQELBQADggEBAELqKjYIrDmiWbSSIQN4Yjk6rmVvXzqc+QZQ3qdhE9PDC9Ov\nTe5e1Y+2YBjI1HbF6lc+nLRQfyTkBpY5eo8KtcPiUkJUxGpVYtg+zttNn1OXUu3a\nAU4w2u5NNklsSrZwGwwtQFXXZIcd3Ov5jaq/penvcjjModJtuA4qX2K26tkDJdE7\nfDkMWkbr6e1yxeofcmy2kYM9r7ayAEP8mVlBeeBoWKtgIzW9AXe7vLZmkBTylGTU\nEWAQSfVkVUirWDDwlZU7ru0y2SyxILRVxzrFsknsGkxHmJWjNH9Bh2RjFqulXFhz\nVuTVC6t7OW9oOTeX3FivB7mOlqTYdIF4tvkS6pM=\n-----END CERTIFICATE-----',
                            privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCijRuLj1BDPFra\nLEQsPyY+6N/XsZ6muoZT6AnsW8odqdQLSV2REKLa0aI12xJM8Cm1aV0nwLl6TfAF\n6MgwOJ9+2x2nwt4HPpGmvm43UvCtMzQ0XtJnyDeLPaAauNXM4xxi3V1tj4GiF6jg\nYAdWG/CJI4HMHYUW9sDTe6cyQc8HKg2DgiR14dJg3OjwzVfJ8MGY7j65LFimdlG7\nshIwlLNydEdOJgKR6TBnUpQ0FQkgl3DhV2KIRnuziPIvUFipKPnJWJB7JU6463qu\n3dg9SAJluE5SbwPQOATthdMPo6Ys4Qbr9htCdH4mSOl8EUJPZWfajmYcVUWP6Orp\n7a99NY5tAgMBAAECggEAH4GvxNt0oG+eoXqihRwBXwC2wGFAYcs2FaXcZIh/EsRT\n4hMolGFP2491/C/X6ntDblL7mCSyHrtkClUuFjCnc4hnhViPPgK56wKurMEB/uQ1\nmnAFotGLOI0rjvpkEGg13JDRFtcRtpgU5taeHWnhc8di1WwkW4jc47DsPaDFTrsg\nGp8l6oU0D6Z0X9mkGLKwEpQ8kPK9r34RsDuu6GLAVfTJaUQqYSNe8ycBblZISYtG\nM2/EmbKgCIf4rS5QCThhrPYsySMmHtCaSDq+zXZ4qqqGLdA8ua69D5cZFcLWh508\n4ewQ0I9DgRTdUBPwaqU7MDSxRCnVmjbWUp71W9KAYQKBgQDMBpNRT04y+UkUK0xJ\nhPaMQcyfjlONQ/1yKtsu7nRQ0NiJ/Ij+Ri4D7WXUe/oI06PppvLXR+kwxnuMAWnF\nyE6hPC1egHd0ZnBbpx1jgLfCEJz2dCZ9peEzY+9Tib+Ch9vrD057KAWaRMyxcCAS\ncOy1/1/lVMJQ6xC0LyXW1ElnjQKBgQDL9cvQI7KH52sfEJq6Eq32svfH7F78gNAF\nlWWHVWEtmWYGKUKd9lZcbNOAGp6jig8wQMl1vmMsODVQMG4b8a1pXgnkay9peb1g\nrrRmFMDHA1ELWaWyOgyZiQ+KDQJgz26MzUOOLK4jsZgQBhKPh3UYgeFsSB+rXwpa\nn4cpB6UaYQKBgQDJ8Wg3fuvEAIKY+BJWYsk2IprLAzEoDjf6nPi+B0ASDeWHDvL5\n27UIJh44p03hFrqTNq/+7iqeIJeBCJUNMyrA5LNzamzSReLIlSy9pFY+O/tg5a6D\nh4DUQQJOCXYJWTgP/eKMfByviZGhv32/Qw7JRbBBahe7yC+MaW5mqVDOsQKBgQCn\nNK9MyCcRUT+5bORbzPp+94M4i+fm+zcOjMZ6Jx2Ow2YngOXTF+L+zFyrdac+DO2c\nslA2TcmBs+bJAZsTH5L5gZV8g/6ParU9MJxF35eWz3o+YtT7AqnXqMxrcXTUptlL\nZu+N+8UbD/nIkSHgNr1hRQDnw0zrMfQMDSJCGblZoQKBgAVhp9NbrI7VRM+rf8VG\nNxy+4tGhb+kfWjagTEFcL61+4/7tHUyuaThzy/EFFwqqatIiBBFIPZyoNFZi5aQo\n3fI4Cy9W8RlCp8iM0ToAVys3z6LbBG4PJZBvHKNsPOY/30f5nlc6W20YJ+EWnumL\nWjNUPjCq+ZxGqVpEbbBzzaxy\n-----END RSA PRIVATE KEY-----', // gitleaks:allow
                            chainCA: {
                                use: '/Common/Shared/ca_example_bundle'
                            }
                        },
                        as3_tls_client: {
                            class: 'TLS_Client',
                            clientCertificate: 'useCert'
                        },
                        as3_tls_server: {
                            class: 'TLS_Server',
                            certificates: [
                                {
                                    certificate: 'useCert'
                                }
                            ]
                        },
                        poolPool: {
                            class: 'Pool',
                            members: [
                                {
                                    serverAddresses: [
                                        '192.0.2.1'
                                    ],
                                    servicePort: 443
                                }
                            ]
                        }
                    }
                },
                exampleTenant2: {
                    class: 'Tenant',
                    exampleApp2: {
                        class: 'Application',
                        httpsVirtual: {
                            class: 'Service_HTTPS',
                            redirect80: false,
                            clientTLS: 'as3_tls_client',
                            serverTLS: 'as3_tls_server',
                            snat: 'self',
                            pool: 'poolPool',
                            virtualAddresses: [
                                '1.1.1.3'
                            ],
                            virtualPort: 443
                        },
                        useCert: {
                            class: 'Certificate',
                            certificate: {
                                bigip: '/Common/default.crt'
                            },
                            privateKey: {
                                bigip: '/Common/default.key'
                            },

                            chainCA: {
                                use: '/Common/Shared/ca_example_bundle'
                            }
                        },
                        as3_tls_client: {
                            class: 'TLS_Client',
                            clientCertificate: 'useCert'
                        },
                        as3_tls_server: {
                            class: 'TLS_Server',
                            certificates: [
                                {
                                    certificate: 'useCert'
                                }
                            ]
                        },
                        poolPool: {
                            class: 'Pool',
                            members: [
                                {
                                    serverAddresses: [
                                        '192.0.2.2'
                                    ],
                                    servicePort: 443
                                }
                            ]
                        }
                    }
                }
            }
        };
        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => assert.isFulfilled(
                getPath('/mgmt/shared/appsvcs/declare')
            ))
            .then((response) => {
                const requestPrivateKey = declaration.declaration.exampleTenant1.exampleApp.useCert.privateKey;
                const requestPrivateKeyTenant2 = '/Common/default.key';
                const responsePrivateKey = response.exampleTenant1.exampleApp.useCert.privateKey;
                const responsePrivateKeyTenant2 = response.exampleTenant2.exampleApp2.useCert.privateKey.bigip;
                assert.notEqual(responsePrivateKey, requestPrivateKey);
                assert.strictEqual(responsePrivateKeyTenant2, requestPrivateKeyTenant2);
            })
            .finally(() => deleteDeclaration());
    });

    it('should handle to configure multiple SNI profiles, while default one has set \'requireSNI\' true or false', () => {
        const certs = [
            {
                matchToSNI: '',
                certificate: 'snidefault'
            },
            {
                matchToSNI: 'https1.example.com',
                certificate: 'sni1'
            },
            {
                matchToSNI: 'https2.example.com',
                certificate: 'sni2'
            }
        ];

        const declaration = {
            class: 'ADC',
            schemaVersion: '3.54.0',
            sni_tenant: {
                class: 'Tenant',
                sni_app: {
                    class: 'Application',
                    template: 'shared',
                    client_ssl_profile: {
                        class: 'TLS_Server',
                        certificates: certs,
                        ciphers: 'DEFAULT',
                        requireSNI: true
                    },
                    snidefault: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    sni1: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    sni2: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                certs[1].sniDefault = true;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                declaration.sni_tenant.sni_app.client_ssl_profile.requireSNI = false;
                certs[1].sniDefault = false;
                certs[2].sniDefault = true;
                return postDeclaration(declaration, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                declaration.sni_tenant.sni_app.client_ssl_profile.requireSNI = false;
                certs[1].sniDefault = false;
                certs[2].sniDefault = false;
                return postDeclaration(declaration, { declarationIndex: 3 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                declaration.sni_tenant.sni_app.client_ssl_profile.requireSNI = false;
                certs[1].sniDefault = true;
                certs[2].sniDefault = true;
                return postDeclaration(declaration, { declarationIndex: 4 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                declaration.sni_tenant.sni_app.client_ssl_profile.requireSNI = true;
                certs[1].sniDefault = true;
                certs[2].sniDefault = true;
                return postDeclaration(declaration, { declarationIndex: 5 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => {
                declaration.sni_tenant.sni_app.service = {};
                declaration.sni_tenant.sni_app.service.class = 'Service_HTTPS';
                declaration.sni_tenant.sni_app.service.virtualAddresses = ['192.0.2.11'];
                declaration.sni_tenant.sni_app.service.serverTLS = 'client_ssl_profile';
                declaration.sni_tenant.sni_app.client_ssl_profile.requireSNI = true;
                certs[1].sniDefault = true;
                certs[2].sniDefault = false;
                return postDeclaration(declaration, { declarationIndex: 6 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~sni_tenant~sni_app~service'))
            .then((response) => {
                assert.strictEqual(response.name, 'service');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/service');
                assert.strictEqual(response.destination, '/sni_tenant/192.0.2.11:443');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~sni_tenant~sni_app~service/profiles'))
            .then((response) => {
                assert.isAtLeast(response.items.length, 3);
                const items = response.items.filter((item) => item.partition === 'sni_tenant');
                const names = items.map((item) => item.name);
                assert.deepEqual(names, ['client_ssl_profile', 'client_ssl_profile-1-', 'client_ssl_profile-2-']);
            })
            .then(() => {
                declaration.sni_tenant.sni_app.service = {};
                declaration.sni_tenant.sni_app.service.class = 'Service_HTTPS';
                declaration.sni_tenant.sni_app.service.virtualAddresses = ['192.0.2.11'];
                declaration.sni_tenant.sni_app.service.serverTLS = 'client_ssl_profile';
                declaration.sni_tenant.sni_app.client_ssl_profile.requireSNI = false;
                certs[1].sniDefault = false;
                certs[2].sniDefault = false;
                return postDeclaration(declaration, { declarationIndex: 7 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~sni_tenant~sni_app~service'))
            .then((response) => {
                assert.strictEqual(response.name, 'service');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/service');
                assert.strictEqual(response.destination, '/sni_tenant/192.0.2.11:443');
            })
            .then(() => getPath('/mgmt/tm/ltm/virtual/~sni_tenant~sni_app~service/profiles'))
            .then((response) => {
                assert.isAtLeast(response.items.length, 3);
                const items = response.items.filter((item) => item.partition === 'sni_tenant');
                const names = items.map((item) => item.name);
                assert.deepEqual(names, ['client_ssl_profile', 'client_ssl_profile-1-', 'client_ssl_profile-2-']);
            })
            .then(() => {
                declaration.sni_tenant.sni_app.service = {};
                declaration.sni_tenant.sni_app.service.class = 'Service_HTTPS';
                declaration.sni_tenant.sni_app.service.virtualAddresses = ['192.0.2.11'];
                declaration.sni_tenant.sni_app.service.serverTLS = 'client_ssl_profile';
                declaration.sni_tenant.sni_app.client_ssl_profile.requireSNI = false;
                certs[1].sniDefault = true;
                certs[2].sniDefault = true;
                return postDeclaration(declaration, { declarationIndex: 8 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'declaration failed');
                assert.strictEqual(response.results[0].response, '01071809:3: Virtual Server /sni_tenant/sni_app/service has more than one clientssl/serverssl profile that is default for SNI.');
            })
            .then(() => {
                declaration.sni_tenant.sni_app.service = {};
                declaration.sni_tenant.sni_app.service.class = 'Service_HTTPS';
                declaration.sni_tenant.sni_app.service.virtualAddresses = ['192.0.2.11'];
                declaration.sni_tenant.sni_app.service.serverTLS = 'client_ssl_profile';
                declaration.sni_tenant.sni_app.client_ssl_profile.requireSNI = true;
                certs[1].sniDefault = true;
                certs[2].sniDefault = true;
                return postDeclaration(declaration, { declarationIndex: 9 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'declaration failed');
                assert.strictEqual(response.results[0].response, '01071809:3: Virtual Server /sni_tenant/sni_app/service has more than one clientssl/serverssl profile that is default for SNI.');
            })
            .finally(() => deleteDeclaration());
    });

    it('should create a multiple certs into single TLS Server profile', () => {
        const certKey = getCert();
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Sample_01: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'generic',
                    virtualServer: {
                        class: 'Service_HTTPS',
                        virtualAddresses: ['192.0.2.1'],
                        redirect80: false,
                        serverTLS: 'ssl_server'
                    },
                    ssl_server: {
                        class: 'TLS_Server',
                        hybrid: true,
                        certificates: [
                            {
                                certificate: 'cert_rsa'
                            },
                            {
                                certificate: 'cert_ecdsa'
                            }
                        ]
                    },
                    cert_rsa: {
                        class: 'Certificate',
                        certificate: certKey.certRsaCert,
                        privateKey: certKey.certRsaKey
                    },
                    cert_ecdsa: {
                        class: 'Certificate',
                        certificate: certKey.certEcdsaCert,
                        privateKey: certKey.certEcdsaKey
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_rsa.crt', '/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_rsa.key', '/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 1 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .finally(() => deleteDeclaration());
    });

    it('should modify the multiple certs in the TLS Server profile', () => {
        const certKey = getCert();
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Sample_01: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'generic',
                    virtualServer: {
                        class: 'Service_HTTPS',
                        virtualAddresses: ['192.0.2.1'],
                        redirect80: false,
                        serverTLS: 'ssl_server'
                    },
                    ssl_server: {
                        class: 'TLS_Server',
                        hybrid: true,
                        certificates: [
                            {
                                certificate: 'cert_rsa'
                            },
                            {
                                certificate: 'cert_ecdsa'
                            }
                        ]
                    },
                    cert_rsa: {
                        class: 'Certificate',
                        certificate: certKey.certRsaCert,
                        privateKey: certKey.certRsaKey
                    },
                    cert_ecdsa: {
                        class: 'Certificate',
                        certificate: certKey.certEcdsaCert,
                        privateKey: certKey.certEcdsaKey
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_rsa.crt', '/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_rsa.key', '/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => {
                const newCertKey = getCert('modified');
                declaration.Sample_01.app.cert_rsa.certificate = newCertKey.certRsaCert;
                declaration.Sample_01.app.cert_rsa.privateKey = newCertKey.certRsaKey;
                declaration.Sample_01.app.cert_ecdsa.certificate = newCertKey.certEcdsaCert;
                declaration.Sample_01.app.cert_ecdsa.privateKey = newCertKey.certEcdsaKey;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_rsa.crt', '/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_rsa.key', '/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => {
                const newCertKey = getCert('default'); // Revert back
                declaration.Sample_01.app.cert_rsa.certificate = newCertKey.certRsaCert;
                declaration.Sample_01.app.cert_rsa.privateKey = newCertKey.certRsaKey;
                declaration.Sample_01.app.cert_ecdsa.certificate = newCertKey.certEcdsaCert;
                declaration.Sample_01.app.cert_ecdsa.privateKey = newCertKey.certEcdsaKey;
                return postDeclaration(declaration, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_rsa.crt', '/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_rsa.key', '/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 3 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .finally(() => deleteDeclaration());
    });

    it('should rename the cert name in the TLS Server profile', () => {
        const certKey = getCert();
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Sample_01: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'generic',
                    virtualServer: {
                        class: 'Service_HTTPS',
                        virtualAddresses: ['192.0.2.1'],
                        redirect80: false,
                        serverTLS: 'ssl_server'
                    },
                    ssl_server: {
                        class: 'TLS_Server',
                        hybrid: true,
                        certificates: [
                            {
                                certificate: 'cert_rsa'
                            },
                            {
                                certificate: 'cert_ecdsa'
                            }
                        ]
                    },
                    cert_rsa: {
                        class: 'Certificate',
                        certificate: certKey.certRsaCert,
                        privateKey: certKey.certRsaKey
                    },
                    cert_ecdsa: {
                        class: 'Certificate',
                        certificate: certKey.certEcdsaCert,
                        privateKey: certKey.certEcdsaKey
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_rsa.crt', '/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_rsa.key', '/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => {
                declaration.Sample_01.app.cert_one_rsa = {};
                declaration.Sample_01.app.cert_one_rsa = declaration.Sample_01.app.cert_rsa;
                declaration.Sample_01.app.ssl_server.certificates[0].certificate = 'cert_one_rsa';
                delete declaration.Sample_01.app.cert_rsa;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_one_rsa.crt', '/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_one_rsa.key', '/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => {
                declaration.Sample_01.app.cert_one_ecdsa = {};
                declaration.Sample_01.app.cert_one_ecdsa = declaration.Sample_01.app.cert_ecdsa;
                declaration.Sample_01.app.ssl_server.certificates[1].certificate = 'cert_one_ecdsa';
                delete declaration.Sample_01.app.cert_ecdsa;
                return postDeclaration(declaration, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_one_rsa.crt', '/Sample_01/app/cert_one_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_one_rsa.key', '/Sample_01/app/cert_one_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 3 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .finally(() => deleteDeclaration());
    });

    it('should remove and re-add the certs in the TLS Server profile', () => {
        let tmpCert = getCert();
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Sample_01: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'generic',
                    virtualServer: {
                        class: 'Service_HTTPS',
                        virtualAddresses: ['192.0.2.1'],
                        redirect80: false,
                        serverTLS: 'ssl_server'
                    },
                    ssl_server: {
                        class: 'TLS_Server',
                        hybrid: true,
                        certificates: [
                            {
                                certificate: 'cert_rsa'
                            },
                            {
                                certificate: 'cert_ecdsa'
                            }
                        ]
                    },
                    cert_rsa: {
                        class: 'Certificate',
                        certificate: tmpCert.certRsaCert,
                        privateKey: tmpCert.certRsaKey
                    },
                    cert_ecdsa: {
                        class: 'Certificate',
                        certificate: tmpCert.certEcdsaCert,
                        privateKey: tmpCert.certEcdsaKey
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration, { declarationIndex: 0 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_rsa.crt', '/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_rsa.key', '/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => {
                tmpCert = declaration.Sample_01.app.cert_rsa;
                delete declaration.Sample_01.app.ssl_server.certificates.shift();
                delete declaration.Sample_01.app.cert_rsa;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 1);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0'];
                const expectedCerts = ['/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 2 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => {
                declaration.Sample_01.app.cert_rsa = {};
                declaration.Sample_01.app.cert_rsa = tmpCert;
                const cert = { certificate: 'cert_rsa' };
                declaration.Sample_01.app.ssl_server.certificates.unshift(cert);
                return postDeclaration(declaration, { declarationIndex: 3 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_rsa.crt', '/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_rsa.key', '/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 4 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => {
                tmpCert = declaration.Sample_01.app.cert_ecdsa;
                delete declaration.Sample_01.app.ssl_server.certificates.pop();
                delete declaration.Sample_01.app.cert_ecdsa;
                return postDeclaration(declaration, { declarationIndex: 5 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 1);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0'];
                const expectedCerts = ['/Sample_01/app/cert_rsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_rsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => {
                declaration.Sample_01.app.cert_ecdsa = {};
                declaration.Sample_01.app.cert_ecdsa = tmpCert;
                const cert = { certificate: 'cert_ecdsa' };
                declaration.Sample_01.app.ssl_server.certificates.push(cert);
                return postDeclaration(declaration, { declarationIndex: 6 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.certKeyChain.length, 2);
                const names = response.certKeyChain.map((cert) => cert.name);
                const certs = response.certKeyChain.map((cert) => cert.cert);
                const keys = response.certKeyChain.map((cert) => cert.key);
                const expectedNames = ['set0', 'set1'];
                const expectedCerts = ['/Sample_01/app/cert_rsa.crt', '/Sample_01/app/cert_ecdsa.crt'];
                const expectedKeys = ['/Sample_01/app/cert_rsa.key', '/Sample_01/app/cert_ecdsa.key'];
                assert.deepEqual(names, expectedNames);
                assert.deepEqual(certs, expectedCerts);
                assert.deepEqual(keys, expectedKeys);
            })
            .then(() => postDeclaration(declaration, { declarationIndex: 7 }))
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .finally(() => deleteDeclaration());
    });

    it('should handle to configure sniDefault when multiple TLS Server profiles are present in the declaration', () => {
        const certs = [
            {
                matchToSNI: '',
                certificate: 'snidefault'
            },
            {
                matchToSNI: 'https1.example.com',
                certificate: 'sni1'
            },
            {
                matchToSNI: 'https2.example.com',
                certificate: 'sni2'
            }
        ];

        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            sni_tenant: {
                class: 'Tenant',
                sni_app: {
                    class: 'Application',
                    template: 'shared',
                    client_ssl_profile: {
                        class: 'TLS_Server',
                        certificates: certs,
                        ciphers: 'DEFAULT',
                        requireSNI: true
                    },
                    snidefault: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    sni1: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    sni2: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                certs[0].sniDefault = true;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'no change');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                certs[0].sniDefault = false;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-1-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~sni_tenant~sni_app~client_ssl_profile-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'client_ssl_profile-2-');
                assert.strictEqual(response.fullPath, '/sni_tenant/sni_app/client_ssl_profile-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .finally(() => deleteDeclaration());
    });

    it('should handle to configure sniDefault when multiple TLS Server profiles are assign to Virtual Server', () => {
        const certKey = getCert();
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Sample_01: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'generic',
                    virtualServer: {
                        class: 'Service_HTTPS',
                        virtualAddresses: ['192.0.2.1'],
                        redirect80: false,
                        serverTLS: [
                            {
                                use: 'ssl_server'
                            },
                            {
                                use: 'ssl_server1'
                            }
                        ]
                    },
                    ssl_server: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                matchToSNI: '',
                                certificate: 'cert_rsa',
                                sniDefault: true
                            }
                        ]
                    },
                    ssl_server1: {
                        class: 'TLS_Server',
                        certificates: [
                            {
                                matchToSNI: 'https1.example.com',
                                certificate: 'cert_ecdsa',
                                sniDefault: false
                            }
                        ]
                    },
                    cert_rsa: {
                        class: 'Certificate',
                        certificate: certKey.certRsaCert,
                        privateKey: certKey.certRsaKey
                    },
                    cert_ecdsa: {
                        class: 'Certificate',
                        certificate: certKey.certEcdsaCert,
                        privateKey: certKey.certEcdsaKey
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                declaration.Sample_01.app.ssl_server.certificates[0].sniDefault = false;
                declaration.Sample_01.app.ssl_server1.certificates[0].sniDefault = true;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                delete declaration.Sample_01.app.ssl_server.certificates[0].sniDefault;
                declaration.Sample_01.app.ssl_server1.certificates[0].sniDefault = false;
                return postDeclaration(declaration, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                delete declaration.Sample_01.app.ssl_server.certificates[0].sniDefault;
                delete declaration.Sample_01.app.ssl_server1.certificates[0].sniDefault;
                return postDeclaration(declaration, { declarationIndex: 3 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'declaration failed');
                assert.strictEqual(response.results[0].response, '01071809:3: Virtual Server /Sample_01/app/virtualServer has more than one clientssl/serverssl profile that is default for SNI.');
            })
            .finally(() => deleteDeclaration());
    });

    it('should handle to configure sniDefault when multiple TLS Server profiles with multiple certificates are assign to Virtual Server', () => {
        const certs = [
            {
                matchToSNI: '',
                certificate: 'snidefault'
            },
            {
                matchToSNI: 'https1.example.com',
                certificate: 'sni1'
            },
            {
                matchToSNI: 'https2.example.com',
                certificate: 'sni2'
            }
        ];
        const certs1 = [
            {
                matchToSNI: 'https3.example.com',
                certificate: 'sni3'
            },
            {
                matchToSNI: 'https4.example.com',
                certificate: 'sni4'
            },
            {
                matchToSNI: 'https5.example.com',
                certificate: 'sni5'
            }
        ];
        const declaration = {
            class: 'ADC',
            schemaVersion: '3.55.0',
            Sample_01: {
                class: 'Tenant',
                app: {
                    class: 'Application',
                    template: 'generic',
                    virtualServer: {
                        class: 'Service_HTTPS',
                        virtualAddresses: ['192.0.2.1'],
                        redirect80: false,
                        serverTLS: [
                            {
                                use: 'ssl_server'
                            },
                            {
                                use: 'ssl_server1'
                            }
                        ]
                    },
                    ssl_server: {
                        class: 'TLS_Server',
                        certificates: certs
                    },
                    ssl_server1: {
                        class: 'TLS_Server',
                        certificates: certs1
                    },
                    snidefault: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    sni1: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    sni2: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    sni3: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    sni4: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    },
                    sni5: {
                        class: 'Certificate',
                        certificate: {
                            bigip: '/Common/default.crt'
                        },
                        privateKey: {
                            bigip: '/Common/default.key'
                        },
                        chainCA: {
                            bigip: '/Common/ca-bundle.crt'
                        }
                    }
                }
            }
        };

        return Promise.resolve()
            .then(() => postDeclaration(declaration), { declarationIndex: 0 })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 422);
                assert.strictEqual(response.results[0].message, 'declaration failed');
                assert.strictEqual(response.results[0].response, '01071809:3: Virtual Server /Sample_01/app/virtualServer has more than one clientssl/serverssl profile that is default for SNI.');
            })
            .then(() => {
                certs1[0].sniDefault = false;
                return postDeclaration(declaration, { declarationIndex: 1 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server-1-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server-2-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1-1-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1-2-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                certs1[0].sniDefault = false;
                declaration.Sample_01.app.ssl_server.requireSNI = true;
                return postDeclaration(declaration, { declarationIndex: 2 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server-1-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server-2-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1-1-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1-2-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => {
                certs[0].sniDefault = false;
                certs1[0].sniDefault = false;
                certs1[2].sniDefault = true;
                declaration.Sample_01.app.ssl_server.requireSNI = false;
                declaration.Sample_01.app.ssl_server1.requireSNI = true;
                return postDeclaration(declaration, { declarationIndex: 3 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server-1-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server-2-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1-1-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1-2-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1-2-');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => {
                certs[0].sniDefault = false;
                certs[1].sniDefault = true;
                certs1[0].sniDefault = false;
                certs1[2].sniDefault = false;
                declaration.Sample_01.app.ssl_server.requireSNI = true;
                declaration.Sample_01.app.ssl_server1.requireSNI = false;
                return postDeclaration(declaration, { declarationIndex: 3 });
            })
            .then((response) => {
                assert.strictEqual(response.results[0].code, 200);
                assert.strictEqual(response.results[0].message, 'success');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server-1-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server-1-');
                assert.strictEqual(response.sniDefault, 'true');
                assert.strictEqual(response.sniRequire, 'true');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server-2-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1-1-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1-1-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1-1-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .then(() => getPath('/mgmt/tm/ltm/profile/client-ssl/~Sample_01~app~ssl_server1-2-'))
            .then((response) => {
                assert.strictEqual(response.name, 'ssl_server1-2-');
                assert.strictEqual(response.fullPath, '/Sample_01/app/ssl_server1-2-');
                assert.strictEqual(response.sniDefault, 'false');
                assert.strictEqual(response.sniRequire, 'false');
            })
            .finally(() => deleteDeclaration());
    });
});
