import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('storage.endpoint');
    const region = config.get<string>('storage.region') ?? 'auto';

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: config.get<string>('storage.accessKey') ?? '',
        secretAccessKey: config.get<string>('storage.secretKey') ?? '',
      },
      forcePathStyle: true, // required for MinIO
    });

    this.bucket = config.get<string>('storage.bucket') ?? 'agencypulse';
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    this.logger.log(`Uploaded: ${key} (${buffer.length} bytes)`);
    return key;
  }

  // Returns a pre-signed URL valid for the given number of seconds (default 7 days)
  async getSignedDownloadUrl(key: string, expiresInSeconds = 604800): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`Deleted: ${key}`);
  }

  // Builds the storage key: tenantId/reportId/YYYY/MM/DD/timestamp.pdf
  static buildPdfKey(tenantId: string, reportId: string): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const ts = now.getTime();
    return `${tenantId}/${reportId}/${yyyy}/${mm}/${dd}/${ts}.pdf`;
  }
}
