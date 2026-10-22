-- DropForeignKey
ALTER TABLE "oauthAccessToken" DROP CONSTRAINT "oauthAccessToken_refreshId_fkey";

-- DropForeignKey
ALTER TABLE "oauthAccessToken" DROP CONSTRAINT "oauthAccessToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "oauthConsent" DROP CONSTRAINT "oauthConsent_userId_fkey";

-- AddForeignKey
ALTER TABLE "oauthAccessToken" ADD CONSTRAINT "oauthAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauthAccessToken" ADD CONSTRAINT "oauthAccessToken_refreshId_fkey" FOREIGN KEY ("refreshId") REFERENCES "oauthRefreshToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauthConsent" ADD CONSTRAINT "oauthConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
