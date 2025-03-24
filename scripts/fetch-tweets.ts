import { XAuthClient } from "./utils";
import { get } from "lodash";
import dayjs from "dayjs";
import fs from "fs-extra";
import type { TweetApiUtilsData } from "twitter-openapi-typescript";

// 读取dev-accounts.json文件获取要追踪的用户列表
const devAccountsPath = "./dev-accounts.json";
let devAccounts = [];
if (fs.existsSync(devAccountsPath)) {
  devAccounts = JSON.parse(fs.readFileSync(devAccountsPath, 'utf-8'));
}

const client = await XAuthClient();
const rows: TweetApiUtilsData[] = [];

// 如果有指定的用户，则获取这些用户的推文
if (devAccounts.length > 0) {
  console.log(`正在获取${devAccounts.length}个指定用户的推文...`);
  
  // 对每个用户获取其推文
  for (const account of devAccounts) {
    const username = account.username;
    console.log(`正在获取用户 ${username} 的推文...`);
    
    try {
      // 从URL中提取用户名（处理可能包含空格或特殊字符的显示名称）
      const twitterUrl = account.twitter_url;
      const urlParts = twitterUrl.split('/');
      const screenName = urlParts[urlParts.length - 1];
      
      console.log(`使用屏幕名: ${screenName}`);
      
      // 使用搜索API获取用户的推文
      const searchQuery = `from:${screenName}`;
      const searchResp = await client.getTweetApi().getSearchTimeline({
        rawQuery: searchQuery,
        count: 5, // 每个用户获取20条推文
        product: "Latest"
      });
      
      if (searchResp.data.data && searchResp.data.data.length > 0) {
        console.log(`获取到 ${searchResp.data.data.length} 条推文`);
        
        // 处理推文
        searchResp.data.data.forEach((tweet: any) => {
          const isQuoteStatus = get(tweet, "raw.result.legacy.isQuoteStatus");
          if (isQuoteStatus) {
            return;
          }
          const fullText = get(tweet, "raw.result.legacy.fullText", "RT @");
          if (fullText?.includes("RT @")) {
            return;
          }
          const createdAt = get(tweet, "raw.result.legacy.createdAt");
          // 只获取7天内的推文
          if (dayjs().diff(dayjs(createdAt), "day") > 7) {
            return;
          }
          const screenName = get(tweet, "user.legacy.screenName");
          const tweetUrl = `https://x.com/${screenName}/status/${get(
            tweet,
            "raw.result.legacy.idStr"
          )}`;
          // 提取用户信息
          const user = {
            screenName: get(tweet, "user.legacy.screenName"),
            name: get(tweet, "user.legacy.name"),
            profileImageUrl: get(tweet, "user.legacy.profileImageUrlHttps"),
            description: get(tweet, "user.legacy.description"),
            followersCount: get(tweet, "user.legacy.followersCount"),
            friendsCount: get(tweet, "user.legacy.friendsCount"),
            location: get(tweet, "user.legacy.location"),
          };

          // 提取图片
          const mediaItems = get(tweet, "raw.result.legacy.extendedEntities.media", []);
          const images = mediaItems
            .filter((media: any) => media.type === "photo")
            .map((media: any) => media.mediaUrlHttps);

          // 提取视频
          const videos = mediaItems
            .filter(
              (media: any) => media.type === "video" || media.type === "animated_gif"
            )
            .map((media: any) => {
              const variants = get(media, "videoInfo.variants", []);
              const bestQuality = variants
                .filter((v: any) => v.contentType === "video/mp4")
                .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
              return bestQuality?.url;
            })
            .filter(Boolean);

          rows.push({
            // @ts-ignore
            user,
            images,
            videos,
            tweetUrl,
            fullText,
          });
        });
      } else {
        console.log(`未获取到 ${username} 的推文`);
      }
    } catch (error) {
      console.error(`获取用户 ${username} 的推文时出错:`, error);
    }
  }
} else {
  // 如果没有指定用户，则获取主页时间线
  console.log("未指定用户，获取主页时间线...");
  const resp = await client.getTweetApi().getHomeLatestTimeline({
    count: 100,
  });

  // 过滤出原创推文
  const originalTweets = resp.data.data.filter((tweet) => {
    return !tweet.referenced_tweets || tweet.referenced_tweets.length === 0;
  });

  // 输出所有原创推文的访问地址
  originalTweets.forEach((tweet) => {
    const isQuoteStatus = get(tweet, "raw.result.legacy.isQuoteStatus");
    if (isQuoteStatus) {
      return;
    }
    const fullText = get(tweet, "raw.result.legacy.fullText", "RT @");
    if (fullText?.includes("RT @")) {
      return;
    }
    const createdAt = get(tweet, "raw.result.legacy.createdAt");
    // return if more than 1 days
    if (dayjs().diff(dayjs(createdAt), "day") > 1) {
      return;
    }
    const screenName = get(tweet, "user.legacy.screenName");
    const tweetUrl = `https://x.com/${screenName}/status/${get(
      tweet,
      "raw.result.legacy.idStr"
    )}`;
    // 提取用户信息
    const user = {
      screenName: get(tweet, "user.legacy.screenName"),
      name: get(tweet, "user.legacy.name"),
      profileImageUrl: get(tweet, "user.legacy.profileImageUrlHttps"),
      description: get(tweet, "user.legacy.description"),
      followersCount: get(tweet, "user.legacy.followersCount"),
      friendsCount: get(tweet, "user.legacy.friendsCount"),
      location: get(tweet, "user.legacy.location"),
    };

    // 提取图片
    const mediaItems = get(tweet, "raw.result.legacy.extendedEntities.media", []);
    const images = mediaItems
      .filter((media: any) => media.type === "photo")
      .map((media: any) => media.mediaUrlHttps);

    // 提取视频
    const videos = mediaItems
      .filter(
        (media: any) => media.type === "video" || media.type === "animated_gif"
      )
      .map((media: any) => {
        const variants = get(media, "videoInfo.variants", []);
        const bestQuality = variants
          .filter((v: any) => v.contentType === "video/mp4")
          .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        return bestQuality?.url;
      })
      .filter(Boolean);

    rows.push({
      // @ts-ignore
      user,
      images,
      videos,
      tweetUrl,
      fullText,
    });
  });
}

const outputPath = `./tweets/${dayjs().format("YYYY-MM-DD")}.json`;
let existingRows: TweetApiUtilsData[] = [];

// 如果文件存在，读取现有内容
if (fs.existsSync(outputPath)) {
  existingRows = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
}

// 合并现有数据和新数据
const allRows = [...existingRows, ...rows];

// 通过 tweetUrl 去重
const uniqueRows = Array.from(
  new Map(allRows.map(row => [row.tweetUrl, row])).values()
);

// 按照 createdAt 倒序排序
const sortedRows = uniqueRows.sort((a, b) => {
  const urlA = new URL(a.tweetUrl);
  const urlB = new URL(b.tweetUrl);
  const idA = urlA.pathname.split('/').pop() || '';
  const idB = urlB.pathname.split('/').pop() || '';
  return idB.localeCompare(idA); // Twitter ID 本身就包含时间信息，可以直接比较
});

fs.writeFileSync(
  outputPath,
  JSON.stringify(sortedRows, null, 2)
);

console.log(`已将${sortedRows.length}条推文保存到${outputPath}`);
