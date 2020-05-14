#! /bin/bash

rm serenadeMe.zip 
zip -r serenadeMe.zip .
aws lambda update-function-code --region $AWS_REGION  --function-name $AWS_FUNCTION_NAME --zip-file fileb://$(pwd)/serenadeMe.zip 