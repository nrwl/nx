# Nx API Spec
## OpenAPI 3.0.3 
The nx-api has an OpenAPI 3.0.3 spec definition available at:

https://api.nrwl.io/api/definition.json

## Authenticating 
To authenticate, you may use your tokens (accessible from Nx Cloud):

![Access tokens](/nx-cloud/reference/access-tokens.png)

Per the spec, you use this token in the `Authentication` header.

## Swagger 
You may use swagger to preview the spec and make requests. We do not serve our own swagger instance publicly, but you may use [the example swagger ui](https://petstore.swagger.io/), and paste in the url to the Nx API definitions (https://api.nrwl.io/api/definition.json).

![Access tokens](/nx-cloud/reference/swagger-preview.png)
