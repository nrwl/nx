# SAML Auth Managed Offering

## Okta Set-up

You'll need the `SAML-IDENTIFIER` from us, unique to your org. We'll provide this once we start setting SAML up for you.
You'll be entering it in the instructions below.

1. Create a new Okta App Integration:

   ![Okta 1](/nx-cloud/enterprise/on-premise/images/saml/okta_1.png)

   ![Okta 2](/nx-cloud/enterprise/on-premise/images/saml/okta_2.png)

2. Give it a name:

   ![Okta 3](/nx-cloud/enterprise/on-premise/images/saml/okta_3.png)

3. On the Next page, configure it as below:

   1. The Single Sign On URL needs to be:
      - If using the main-US cluster: `https://auth.nx.app/login/callback?connection=SAML-IDENTIFIER`
   2. The Audience should be `urn:auth0:nrwl:SAML-IDENTIFIER`
      - If using the main-US cluster: `urn:auth0:nrwl:SAML-IDENTIFIER`

{% callout type="note" title="EU Cluster" %}
Contact your developer productivity engineer (DPE) to configure SAML auth in the EU cluster. The EU cluster is only available for enterprise customers.
{% /callout %}

![Okta 4](/nx-cloud/enterprise/on-premise/images/saml/okta_4_public.png)

4. Scroll down to attribute statements and configure them as per below:

   ![Okta 5](/nx-cloud/enterprise/on-premise/images/saml/okta_5.png)

5. Click “Next”, and select the first option on the next screen.
6. Go to the assignments tab and assign the users that can login to the Nx Cloud WebApp:

   1. **Note:** This just gives them permission to use the Nx Cloud web app with their own workspace. Users will still need to be invited manually through the web app to your main workspace.

   ![Okta 6](/nx-cloud/enterprise/on-premise/images/saml/okta_6.png)

7. Then in the Sign-On tab scroll down:

   ![Okta 7](/nx-cloud/enterprise/on-premise/images/saml/okta_7.png)

8. Scroll down and from the list of certificates, download the one with the “Active” status:

   ![Okta 8](/nx-cloud/enterprise/on-premise/images/saml/okta_8.png)

9. Then view the ldP metadata:

   ![Okta 9](/nx-cloud/enterprise/on-premise/images/saml/okta_9.png)

10. Then find the row similar to the below, and copy the highlighted URL (see screenshot as well):

    1. ```html
       <md:SingleSignOnService
         Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
         Location="https://trial-xxxxx.okta.com/app/trial-xxxxx_nxcloudtest_1/xxxxxxxxx/sso/saml"
       />
       ```

    ![Okta 10](/nx-cloud/enterprise/on-premise/images/saml/okta_10.png)

11. Send us via email:
    - your _public_ certificate downloaded in step 8
    - your URL from step 10
