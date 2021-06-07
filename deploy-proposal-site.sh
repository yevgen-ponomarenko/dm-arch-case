#!/bin/bash

cd cdk
npm install
tsc
cdk deploy --outputs-file ../outputs.json
cd ../
pip install -r requirements.txt
mkdocs build -d ./site

export BUCKET_URI="s3://$(cat outputs.json | jq -r .Life1ProposalStack.bucketName)"
export CLOUDFRONT_DISTRIBUTION_ID=$(cat outputs.json | jq -r .Life1ProposalStack.cloudFrontDistributionId)

echo $CLOUDFRONT_DISTRIBUTION_ID

aws s3 sync ./site $BUCKET_URI
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*.*"

rm -r ./site
rm outputs.json