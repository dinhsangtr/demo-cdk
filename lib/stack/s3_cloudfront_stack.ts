import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';

interface S3StackProps extends cdk.StackProps {
  env: cdk.Environment;
  stage: string;
  route53: {
    domainName: string;
    hostedZoneName: string;
  };
  acm: {
    domainName: string;
    certificateARN?: string;
  };
}

/*
 * This will create the s3, cloudfront stack
 * that use to store and hosting our web app.
 */
export class BucketStack extends cdk.Stack {
  readonly s3Bucket: s3.IBucket;
  readonly distribution: cloudfront.IDistribution;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    this.s3Bucket = new s3.Bucket(this, id + '-s3', {
      // Used to specify the name of the S3 bucket that will be created.
      bucketName: id + '-s3',
      // The name of the error document to use when the web application encounters an error.
      websiteErrorDocument: 'index.html',
      // The name of the index document to serve as the entry point for the web application.
      websiteIndexDocument: 'index.html',
      // A boolean value that specifies whether the objects in the bucket are publicly readable.
      // publicReadAccess: true,
      // Specifies the removal policy for the bucket.
      // - Here, "REMOVAL_POLICY.DESTROY" is set,
      // - which will remove the bucket when the CloudFormation stack is deleted.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // Specifies the object ownership policy for the bucket.
      // - Here, BUCKET_OWNER_PREFERRED is set,
      // - which will always use the bucket owner as the object owner.
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });

    const hostedZone = route53.HostedZone.fromLookup(this, id + '-hostedZone', {
      domainName: props.route53.hostedZoneName,
    });

    const certificate = acm.Certificate.fromCertificateArn(
      this,
      id + '-cert',
      props.acm.certificateARN || 'test'
    );

    this.distribution = new cloudfront.Distribution(this, id + '-cf-dist', {
      // The default behavior for the CloudFront distribution,
      // which includes the origin for the S3 bucket,
      // viewer protocol policy, and allowed methods.
      defaultBehavior: {
        // The S3 bucket origin for the CloudFront distribution.
        origin: new origins.S3Origin(this.s3Bucket, {
          // The unique identifier for the S3 bucket origin
          originId: id + '-origin',
        }),
        // The policy for viewer protocols,
        // which is set to REDIRECT_TO_HTTPS in this case.
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // The allowed HTTP methods for the CloudFront distribution,
        // which is set to ALLOW_ALL in this case.
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      // The error responses to display for the CloudFront distribution,
      // which includes the HTTP status code, response HTTP status, response page path, and TTL.
      errorResponses: [
        {
          // The HTTP status code for the error response.
          httpStatus: 403,
          // The HTTP status for the response.
          responseHttpStatus: 200,
          // The path to the error response page.
          responsePagePath: '/index.html',
          // The TTL for the error response.
          ttl: cdk.Duration.seconds(10),
        },
      ],
      // The default root object for the CloudFront distribution,
      // which is set to index.html in this case.
      defaultRootObject: 'index.html',
      // The domain names for the CloudFront distribution,
      // which includes the custom domain name specified in Route53.
      domainNames: [props.route53.domainName],
      // The SSL certificate to use for the CloudFront distribution.
      certificate: certificate,
    });

    new route53.ARecord(this, id + '-record', {
      // The hosted zone for the Route53 A record.
      zone: hostedZone,
      // The name of the Route53 A record, which is set to the custom domain name.
      recordName: props.route53.domainName,
      // The target for the Route53 A record, which is an alias to the CloudFront distribution.
      target: route53.RecordTarget.fromAlias(
        // The target type for the alias, which is a CloudFront distribution.
        new CloudFrontTarget(this.distribution)
      ),
    });
  }
}
