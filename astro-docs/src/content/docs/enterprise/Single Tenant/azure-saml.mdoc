---
title: Azure SAML Auth
description: Configure SAML authentication for Nx Cloud Enterprise with Azure
filter: 'type:Guides'
---

## SAML setup

1. Create a new enterprise app

   ![Create new enterprise application in Azure](../../../../assets/enterprise/single-tenant/saml/azure_1.png)

   ![Select create your own application](../../../../assets/enterprise/single-tenant/saml/azure_2.png)

2. Choose "Create your own":

   ![Choose create your own application option](../../../../assets/enterprise/single-tenant/saml/azure_3.png)

3. Give it a name

   ![Enter enterprise application name](../../../../assets/enterprise/single-tenant/saml/azure_4.png)

4. Assign your users and/or groups to it:

   ![Assign users and groups to application](../../../../assets/enterprise/single-tenant/saml/azure_5.png)

5. Then set-up SSO

   ![Set up single sign-on](../../../../assets/enterprise/single-tenant/saml/azure_6.png)

6. And choose SAML:

   ![Select SAML authentication method](../../../../assets/enterprise/single-tenant/saml/azure_7.png)

7. Add these configuration options
   1. Configure the Identifier **exactly** as `nx-private-cloud`
   2. For the **Reply URL**, it should point to your Private Cloud instance URL. Make sure it ends with `/auth-callback`

   ![Configure SAML identifier and reply URL](../../../../assets/enterprise/single-tenant/saml/azure_8.png)

8. Scroll down and manage claims:

   ![Manage SAML attribute claims](../../../../assets/enterprise/single-tenant/saml/azure_9.png)

9. The first row should be the `email` claim, click to Edit it:

   ![Edit email claim configuration](../../../../assets/enterprise/single-tenant/saml/azure_10.png)

10. Configure it as per below
    1. **"Namespace"** needs to be blank
    2. **"Name:"** needs to be "email"
    3. See screenshot below. This is an important step, because Nx Cloud will expect the "email" property on each profile that logs in.

    ![Set email claim name and namespace](../../../../assets/enterprise/single-tenant/saml/azure_11.png)

    Make sure your application user profile exposes the email address under `user.mail`. This can be configured in `Users and Groups` in the Azure portal. Alternatively, you can always configure the `email` claim to use a different property under the `user` object.

11. Under `SAML Certificates`, click the pencil icon to edit

    ![Edit SAML certificate signing options](../../../../assets/enterprise/single-tenant/saml/azure_12.png)

    For **Signing Option**, select **Sign SAML response and assertion**

    ![Select sign SAML response and assertion](../../../../assets/enterprise/single-tenant/saml/azure_13.png)

    Then click **Save** and close the popover.

12. Download the certificate in **Base64**:

    ![Download Base64 certificate](../../../../assets/enterprise/single-tenant/saml/azure_14.png)

13. Extract the downloaded certificate value as a one-line string:
    1. `awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' azure_cert_file.cer`
    2. We'll use this later
14. Copy the Login URL:

    ![Copy login URL from Azure portal](../../../../assets/enterprise/single-tenant/saml/azure_15.png)

## SCIM provisioning

SCIM provisioning enables automatic user lifecycle management for Nx Cloud through Microsoft Entra ID.

Before you start:

- SAML authentication must already be configured and working, using the steps above.
- You need a SCIM bearer token (JWT), your Nx Cloud organization ID, and your Nx Cloud app URL.
  Your developer productivity engineer (DPE) provides these values.
- Create two groups in Entra ID for Nx Cloud access: one for regular members and one for admins.
  A user being provisioned must belong to only one of these groups.

### Create app roles

1. Go to **App registrations** > **Private Nx Cloud** > **App roles**

   ![App roles page for the Private Nx Cloud app registration](../../../../assets/enterprise/single-tenant/saml/azure_scim_1.png)

2. Click **Create app role** and set:
   1. Display name: `READ`
   2. Allowed member types: **Users/Groups**
   3. Value: `READ`
   4. Description: `Nx Cloud Read Role`

   ![Create the READ app role](../../../../assets/enterprise/single-tenant/saml/azure_scim_2.png)

3. Click **Create app role** again for the write role and set:
   1. Display name: `WRITE`
   2. Allowed member types: **Users/Groups**
   3. Value: `Write`
   4. Description: `Nx Cloud Admin/Write Role`

   ![Create the WRITE app role](../../../../assets/enterprise/single-tenant/saml/azure_scim_3.png)

### Configure the SCIM endpoint

1. Go to **Enterprise applications** > **Private Nx Cloud** > **Provisioning**
2. Click **Connect your application**

   ![Connect your application from the provisioning page](../../../../assets/enterprise/single-tenant/saml/azure_scim_4.png)

3. Fill in the form:
   1. Tenant URL: `https://<your-nx-cloud-url>/v1/scim?aadOptscim062020`
      - `aadOptscim062020` is a [feature toggle in Entra ID](https://learn.microsoft.com/en-us/entra/identity/app-provisioning/application-provisioning-config-problem-scim-compatibility#flags-to-alter-the-scim-behavior) that makes the request structure follow the SCIM specification
   2. Secret Token: your SCIM bearer token (JWT)

   ![Enter the tenant URL and secret token](../../../../assets/enterprise/single-tenant/saml/azure_scim_5.png)

4. Click **Test Connection** to confirm it succeeds
5. Click **Create**

### Configure group attribute mapping

Nx Cloud doesn't provision groups, only users, so turn this mapping off.

1. Go to **Enterprise applications** > **Private Nx Cloud** > **Provisioning** > **Attribute mapping**
2. Click **Provision Microsoft Entra ID Groups**
3. Toggle **Enabled** to **Off**

   ![Disable the group provisioning mapping](../../../../assets/enterprise/single-tenant/saml/azure_scim_6.png)

### Configure user attribute mapping

Nx Cloud reads an access specification from a custom SCIM attribute to determine what each provisioned user can do in your workspace.

1. Go to **Enterprise applications** > **Private Nx Cloud** > **Provisioning** > **Attribute mapping**
2. Click **Provision Microsoft Entra ID Users**
3. Scroll down and check **Show advanced options**
4. Click **Edit attribute list for customappsso**

   ![Edit the attribute list for the custom SCIM app](../../../../assets/enterprise/single-tenant/saml/azure_scim_7.png)

5. Scroll to the bottom and add a new attribute:
   1. Name: `urn:ietf:params:scim:schemas:extension:nxcloud:2.0:User:nxCloudAccessSpec`
   2. Type: **String**
   3. Required: **True**
6. Click **Save**
7. Go back to **Provision Microsoft Entra ID Users** and find the `mailNickname` to `externalId` mapping
   - Entra ID creates this mapping by default. If it's missing, click **Add new mapping**.
8. Set the following values, then click **Ok**:
   1. Mapping Type: **Direct**
   2. Source attribute: `userPrincipalName`
   3. Target attribute: `externalId`
   4. Match objects using this attribute: **No**
   5. Apply this mapping: **Always**

   ![Map userPrincipalName to externalId](../../../../assets/enterprise/single-tenant/saml/azure_scim_8.png)

9. Back on **Provision Microsoft Entra ID Users**, click **Add new mapping**
10. Set the following values, then click **Ok**:
    1. Mapping Type: **Expression**
    2. Expression: `Append("nxcloud:ORGANIZATION:<organization_id>:", SingleAppRoleAssignment([appRoleAssignments]))`
       - Replace `<organization_id>` with your Nx Cloud organization ID
    3. Target attribute: `urn:ietf:params:scim:schemas:extension:nxcloud:2.0:User:nxCloudAccessSpec`
    4. Match objects using this attribute: **No**
    5. Apply this mapping: **Always**

    ![Map the app role assignment to the nxCloudAccessSpec expression](../../../../assets/enterprise/single-tenant/saml/azure_scim_9.png)

11. Remove every mapped attribute except:
    - `userName`
    - `active`
    - `displayName`
    - `emails[type eq "work"].value`
    - `name.givenName`
    - `name.familyName`
    - `name.formatted`
    - `urn:ietf:params:scim:schemas:extension:nxcloud:2.0:User:nxCloudAccessSpec`
    - `externalId`
12. Click **Save**

### Associate groups

1. Go to **Enterprise applications** > **Private Nx Cloud** > **Provisioning** > **Users and groups**

   ![Users and groups tab under provisioning](../../../../assets/enterprise/single-tenant/saml/azure_scim_10.png)

2. Click **Add user/group**
3. Click **None Selected** under **Users and groups**, select your Nx Cloud member group, then click **Select**

   ![Select the Nx Cloud member group](../../../../assets/enterprise/single-tenant/saml/azure_scim_11.png)

4. Click **None Selected** under **Select a role**, select **READ**, then click **Select**

   ![Assign the READ role to the group](../../../../assets/enterprise/single-tenant/saml/azure_scim_12.png)

5. Click **Assign**
6. Repeat steps 2 through 5 for the Nx Cloud admin group, assigning the **WRITE** role instead

   ![Select the Nx Cloud admin group](../../../../assets/enterprise/single-tenant/saml/azure_scim_13.png)

   ![Confirm the WRITE role for the admin group](../../../../assets/enterprise/single-tenant/saml/azure_scim_14.png)

### Test provisioning

1. Go to **Enterprise applications** > **Private Nx Cloud** > **Provisioning** > **Provision on demand**
2. Select a user who belongs to one of the groups you assigned above
3. Click **Provision**
4. A new user shows a green check mark next to every step on success

If provisioning fails, contact your DPE.

## Information to exchange with your DPE

Your DPE provides the following values up front so you can complete both the SAML and SCIM configuration.

### From your DPE

1. **Nx Cloud app URL** — used as the Reply URL (step 7) and the SCIM tenant URL
2. **SCIM bearer token (JWT)** — used as the SCIM secret token
3. **Nx Cloud organization ID** — used in the `nxCloudAccessSpec` expression mapping

### Send back to your DPE

After completing the setup, send the following so your DPE can finish connecting your Nx Cloud instance:

1. **SAML Certificate** — the one-line certificate string extracted in step 13: `SAML_CERT=<your-cert-string>`
2. **SAML Entry Point** — the login URL copied in step 14: `SAML_ENTRY_POINT=<your-login-url>`
