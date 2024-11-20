# SAML Auth

SAML support for Nx Cloud is an addon for Nx Enterprise contracts and requires an unlock key. Please [get in touch](mailto:cloud-support@nrwl.io)
if you are interested.

### Jump To

- [Azure AD Config](#azure-active-directory-set-up)
- [Okta Config](#okta-setup)

## Azure Active Directory Set-up

1. Create a new enterprise app

   ![Step 1](/nx-cloud/enterprise/single-tenant/images/saml/azure_1.png)

   ![Step 2](/nx-cloud/enterprise/single-tenant/images/saml/azure_2.png)

2. Choose “Create your own”:

   ![Step 3](/nx-cloud/enterprise/single-tenant/images/saml/azure_3.png)

3. Give it a name

   ![Step 4](/nx-cloud/enterprise/single-tenant/images/saml/azure_4.png)

4. Assign your users and/or groups to it:

   ![Step 5](/nx-cloud/enterprise/single-tenant/images/saml/azure_5.png)

5. Then set-up SSO

   ![Step 6](/nx-cloud/enterprise/single-tenant/images/saml/azure_6.png)

6. And choose SAML:

   ![Step 7](/nx-cloud/enterprise/single-tenant/images/saml/azure_7.png)

7. Add these configuration options

   1. Configure the Identifier **exactly** as `nx-private-cloud`
   2. For the **Reply URL**, it should point to your Private Cloud instance URL. Make sure it ends with `/auth-callback`

   ![Step 8](/nx-cloud/enterprise/single-tenant/images/saml/azure_8.png)

8. Scroll down and manage claims:

   ![Step 9](/nx-cloud/enterprise/single-tenant/images/saml/azure_9.png)

9. The first row should be the `email` claim, click to Edit it:

   ![Step 10](/nx-cloud/enterprise/single-tenant/images/saml/azure_10.png)

10. Configure it as per below

    1. **“Namespace”** needs to be blank
    2. **“Name:”** needs to be “email”
    3. See screenshot below. This is an important step, because Nx Cloud will expect the “email” property on each profile that logs in.

    ![Step 11](/nx-cloud/enterprise/single-tenant/images/saml/azure_11.png)

    Make sure your application user profile exposes the email address under `user.mail`. This can be configured in `Users and Groups` in the Azure portal. Alternatively, you can always configure the `email` claim to use a different property under the `user` object.

11. Under `SAML Certificates`, click the pencil icon to edit

    ![Step 12](/nx-cloud/enterprise/single-tenant/images/saml/azure_12.png)

    For **Signing Option**, select **Sign SAML response and assertion**

    ![Step 13](/nx-cloud/enterprise/single-tenant/images/saml/azure_13.png)

    Then click **Save** and close the popover.

12. Download the certificate in **Base64**:

    ![Step 14](/nx-cloud/enterprise/single-tenant/images/saml/azure_14.png)

13. Extract the downloaded certificate value as a one-line string:
    1. `awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' azure_cert_file.cer`
    2. We’ll use this later
14. Copy the Login URL:

    ![Step 15](/nx-cloud/enterprise/single-tenant/images/saml/azure_15.png)

15. Save the following information to send to your DPE:
    1. `SAML_CERT=<your-cert-string-from-above>`
    2. `SAML_ENTRY_POINT=<your-login-url-from-above>`

## Okta Set-up

1. Create a new Okta App Integration:

   ![Okta 1](/nx-cloud/enterprise/single-tenant/images/saml/okta_1.png)

   ![Okta 2](/nx-cloud/enterprise/single-tenant/images/saml/okta_2.png)

2. Give it a name:

   ![Okta 3](/nx-cloud/enterprise/single-tenant/images/saml/okta_3.png)

3. On the Next page, configure it as below:

   1. The Single Sign On URL needs to point to your Nx Cloud instance URL and ends with `/auth-callback`
   2. The Audience should be `nx-private-cloud`

   ![Okta 4](/nx-cloud/enterprise/single-tenant/images/saml/okta_4.png)

4. Scroll down to attribute statements and configure them as per below:

   ![Okta 5](/nx-cloud/enterprise/single-tenant/images/saml/okta_5.png)

5. Click “Next”, and select the first option on the next screen.
6. Go to the assignments tab and assign the users that can login to the Nx Cloud WebApp:

   1. **Note:** This just gives them permission to use the Nx Cloud web app with their own workspace. Users will still need to be invited manually through the web app to your main workspace.

   ![Okta 6](/nx-cloud/enterprise/single-tenant/images/saml/okta_6.png)

7. Then in the Sign-On tab scroll down:

   ![Okta 7](/nx-cloud/enterprise/single-tenant/images/saml/okta_7.png)

8. Scroll down and from the list of certificates, download the one with the “Active” status:

   ![Okta 8](/nx-cloud/enterprise/single-tenant/images/saml/okta_8.png)

9. Extract the downloaded certificate value as a one-line string:
   1. `awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' okta.cert`
   2. We'll use this later
10. Then view the ldP metadata:

    ![Okta 9](/nx-cloud/enterprise/single-tenant/images/saml/okta_9.png)

11. Then find the row similar to the below, and copy the highlighted URL (see screenshot as well):

    1. ```html
       <md:SingleSignOnService
         Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
         Location="https://trial-xxxxx.okta.com/app/trial-xxxxx_nxcloudtest_1/xxxxxxxxx/sso/saml"
       />
       ```

    ![Okta 10](/nx-cloud/enterprise/single-tenant/images/saml/okta_10.png)

## Connect Your Nx Cloud Installation to Your SAML Set Up

Contact your developer productivity engineer to connect your Nx Cloud instance to the SAML configuration.
