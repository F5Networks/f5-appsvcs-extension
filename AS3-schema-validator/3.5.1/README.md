## AS3 Schema Validator for AS3 3.5.1 and 3.5.0

The AS3 validator is an offline tool to validate AS3 declarations using AS3 3.5.1 (LTS) and 3.5.0. This tool also validates the AS3 declaration is a valid JSON object.  Follow the instructions in this file to download and install the validator tool, and then use the **Help** tab in the validator to use this tool.

### REQUIREMENTS AND NOTES

Validator requires:

- Node.js (version 6.0.0 or greater is recommended).
- One of the following package managers 
  - npm (version 3.8.6 or greater) or yarn (version 0.19.0 or greater)
- The validator is specific to an AS3 release. This means this validator for 3.5.1 and 3.5.0 will not validate other versions of AS3 correctly.

## INSTALLATION

1. Download and extract the Validator Tool which is in [build.zip](build.zip).  

2. Install the tool 

    - Install serve (static server) globally using either of the following commands
        - yarn global add serve
        - npm install -g serve

    - Inside the as3validatortool directory run  ```serve -s build```

    - To set a port (optional) run ```serve -s build -p 5000```  <br>      Note: The default port is 5000.

3. Once it is installed, use the **Help** tab for specific instructions on using the validator.



If you have any feedback, email solutionsfeedback@f5.com