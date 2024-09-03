# Explain with AI (beta)

{% youtube
src="https://youtu.be/g2m9cHp-O-Q"
title="Explain with AI"
 /%}

"Explain with AI" helps you understand complex errors more quickly by providing AI-powered error resolution steps. This is made possible by using additional context from Nx targets and metadata, allowing for more accurate and relevant responses.

![explain with ai](/nx-cloud/features/explain-with-ai.avif)

## Enable Explain with AI

To use the "Explain with AI" feature, you need to [enable AI features for your organization](/ci/concepts/nx-cloud-ai#enable-nx-cloud-ai-features). In the **settings** menu, locate the "AI Features" section and toggle it to "On".

![enable ai features](/nx-cloud/features/ai-features.png)

AI features are available only for the [Nx Cloud Pro plan](/pricing). If you are on the Hobby plan, you can start a free trial to test AI features in your workspace.

## Using Explain with AI

{% callout type="check" title="Authentication Required" %}
If you don't see the "Explain with AI" button, ensure you are logged into the application.
{% /callout %}

1. **Access the Task**:

   - Navigate to the Nx Cloud dashboard and locate the task that failed.
   - Click on the task to open the detailed view.

2. **Initiate AI Explanation**:

   - In the task details, find the "Explain with AI" button.
   - Click on this button to start the AI analysis.
     ![explain with ai button](/nx-cloud/features/explain-with-ai-1.png)

3. **Review the Explanation**:

   - The AI will analyze the error log with additional context from the project task and provide a detailed explanation of the failure.
   - It will also offer suggestions on how to resolve the issue.
     ![explain response](/nx-cloud/features/explain-with-ai-2.png)

4. **Implement the Suggestions**:

   - Review the AI-generated suggestions carefully.
   - Apply the recommended changes to your codebase.

5. **Verify the Fix**:

   - After making the changes, rerun the task to see if the issue is resolved.

6. **Mark Answer as Not Helpful** (Optional):
   - If the suggested changes did not help, click on "Set answer as not helpful." This helps us continuously improve the responses.
