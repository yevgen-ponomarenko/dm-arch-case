import * as cdk from '@aws-cdk/core';
import * as iam from "@aws-cdk/aws-iam";
import * as s3 from "@aws-cdk/aws-s3";
import * as lambda from "@aws-cdk/aws-lambda";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";

export class Life1ProposalStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucketName = `dm-assessment-life1-proposal-${this.GetShortRegionName(this.region)}`;
    const bucket = new s3.Bucket(this, "Life1ProposalBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      bucketName: bucketName,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false
    });

    const redirectToIndexLambdaAtEdge = new lambda.Function(this, "RedirectToIndexIfFolderFunction", {
      functionName: `dm-assessment-life1-proposal-redirect-to-index`,
      code: lambda.Code.fromInline(`
"use strict";

exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request;
  const uriSegments = request.uri.split('/').filter(s => s);
  const lastUriSegment = uriSegments.reverse()[0];
  if (request.uri.endsWith('/') && !/\w+\.\w+/.test(lastUriSegment)) {
    request.uri = request.uri + 'index.html';
  }
  callback(null, request);
}
              `),
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: "index.handler"
    });
    bucket.grantRead(redirectToIndexLambdaAtEdge);

    const s3Origin = new origins.S3Origin(bucket);
    const cloudFrontDistribution = new cloudfront.Distribution(this, "Life1ProposalDistro", {
      defaultBehavior: {
        origin: s3Origin,
        edgeLambdas: [{
          functionVersion: new lambda.Version(this, "RedirectToIndexIfFolderFunctionVersion", {
            lambda: redirectToIndexLambdaAtEdge
          }),
          eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST
        }
        ]
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/404.html"
        }
      ]
    });

    new cdk.CfnOutput(this, "cloudFrontDistributionId", {
      value: cloudFrontDistribution.distributionId
    });

    new cdk.CfnOutput(this, "bucketName", {
      value: bucket.bucketName
    });
  }

  private GetShortRegionName(regionName: string): string {
    return regionName.split("-").reduce((res, it) => {
        const knownExceptions: { [key: string]: string } = {
            "southeast": "se",
            "southwest": "sw",
            "northeast": "ne",
            "northwest": "nw",
        };
        return !!res ? res + (knownExceptions[it] ?? it[0]) : it;
    }, "");
  } 
}
