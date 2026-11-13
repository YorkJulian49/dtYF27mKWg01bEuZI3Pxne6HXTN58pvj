
// 黄果短剧 · 映匣（Yingxia / TVBox）JS 源
// 站点：https://huangguoai.com
//
// 新版播放接口：
// POST /api/videos/{id}/episodes/{ep}/playback
//
// 旧版播放接口：
// GET /api/videos/{id}/play?ep=N&page_texts=0
//
// 封面：pic.drleao.cn 使用 AES-128-CBC 加密
// 需要本地 CFRelay 的 /aesimg 解密服务。

const HG_SITE = "https://huangguoai.com";
const HG_EDGE = HG_SITE + "/api/edge/request";

const HG_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";

const HG_HEADERS = {
  "User-Agent": HG_UA,
  "Referer": HG_SITE + "/",
  "Origin": HG_SITE,
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "Content-Type": "application/json"
};

// 本地图片解密中继
const HG_RELAY = "http://127.0.0.1:8848";

const HG_CHANNELS = [
  { slug: "ai-duanju", name: "AI成人短剧" },
  { slug: "ai-manju", name: "AI成人漫剧" },
  { slug: "ai-huanlian", name: "AI换脸" },
  { slug: "ai-mogai", name: "AI魔改" }
];

const HG_RANKS = [
  { key: "hot", name: "热播榜" },
  { key: "recommend", name: "推荐榜" },
  { key: "potential", name: "潜力榜" }
];

const HG_PAGE_SIZE = 20;


// ==================== 网络请求 ====================

function hgEdge(path, method, bodyBase64, contentType) {
  var verb = String(method || "GET").toUpperCase();

  var payload = JSON.stringify({
    method: verb,
    path: path,
    body: bodyBase64 || "",
    content_type: contentType || ""
  });

  var res = null;

  try {
    res = req(HG_EDGE, {
      method: "POST",
      headers: HG_HEADERS,
      body: payload,
      timeout: 20000
    });
  } catch (error) {
    throw new Error(
      "请求失败：" + path + "（" +
      (error && error.message ? error.message : error) + "）"
    );
  }

  if (!res || res.code !== 200) {
    throw new Error(
      "接口 HTTP " + (res ? res.code : "无响应") +
      "：" + path
    );
  }

  var text = String(
    res.content == null ? "" : res.content
  );

  var outer;

  try {
    outer = JSON.parse(text);
  } catch (error) {
    throw new Error(
      "接口返回不是 JSON：" + text.slice(0, 160)
    );
  }

  if (!outer || outer.status !== 1) {
    throw new Error(
      "接口提示：" +
      ((outer && outer.msg) || "未知错误")
    );
  }

  return outer.data;
}


// ==================== 图片处理 ====================

// 封面 URL 处理
function hgPic(url) {
  var value = String(
    url == null ? "" : url
  ).trim();

  if (!value) return "";

  // 协议相对地址
  if (value.indexOf("//") === 0) {
    value = "https:" + value;
  }

  // 站内相对地址
  else if (value.charAt(0) === "/") {
    value = HG_SITE + value;
  }

  if (!/^https?:\/\//i.test(value)) {
    return "";
  }

  // 黄果加密图片 CDN 必须经过 AES 解密
  if (/^https?:\/\/pic\.drleao\.cn\//i.test(value)) {
    return HG_RELAY +
      "/aesimg?u=" +
      encodeURIComponent(value);
  }

  // 其他图片直接返回
  return value;
}


// 兼容不同封面字段
function hgCover(item) {
  if (!item) return "";

  return item.cover ||
    item.cover_url ||
    item.titlepic ||
    item.poster ||
    item.poster_url ||
    item.image ||
    item.image_url ||
    item.thumbnail ||
    item.thumb ||
    "";
}


// ==================== 数据映射 ====================

function hgDate(text) {
  var value = String(
    text == null ? "" : text
  );

  if (!value) return "";

  return value.length >= 10
    ? value.slice(5, 10)
    : value;
}


function hgVod(item) {
  var id = item && (
    item.id != null ? item.id : item.video_id
  );

  var name = String(
    (item && item.title) || ""
  ).trim();

  var eps = parseInt(
    (item && item.episode_count) ||
    (item && item.total_episodes) || 0,
    10
  );

  var remarks = [];

  if (eps > 0) {
    remarks.push("全 " + eps + " 集");
  }

  if (item && item.is_finished) {
    remarks.push("完结");
  }

  if (item && item.score) {
    remarks.push("★" + item.score);
  }

  return {
    vod_id: String(id == null ? "" : id),
    vod_name: name,
    vod_pic: hgPic(hgCover(item)),
    vod_remarks:
      remarks.join(" · ") ||
      hgDate(item && item.new_at)
  };
}


function hgList(data) {
  var items = (
    data &&
    (data.items || data.list || data.data)
  ) || [];

  var list = [];

  for (var i = 0; i < items.length; i++) {
    if (!items[i]) continue;
    list.push(hgVod(items[i]));
  }

  return list;
}


function hgPager(data, page, listLength) {
  var pg = (data && data.pagination) || {};

  var current = parseInt(pg.page, 10) || page;
  var pages = parseInt(pg.pages, 10) || 1;

  return {
    page: current,
    pagecount: pages,
    limit:
      parseInt(pg.size, 10) ||
      listLength ||
      HG_PAGE_SIZE,
    total: parseInt(pg.total, 10) || 0
  };
}


// ==================== 播放地址提取 ====================

function hgPickPlayUrl(info) {
  if (!info || typeof info !== "object") {
    return "";
  }

  var streams = info.streams || {};

  var url =
    info.video_url ||
    streams.main ||
    info.video_url_hevc ||
    streams.hevc ||
    "";

  return String(url).trim();
}


// ==================== SPIDER ====================

var SPIDER = {

  init: function (ext) {
    return true;
  },


  // 首页分类
  home: function (filter) {
    var classes = [
      {
        type_id: "latest",
        type_name: "最新"
      }
    ];

    for (var r = 0; r < HG_RANKS.length; r++) {
      classes.push({
        type_id: "rank:" + HG_RANKS[r].key,
        type_name: HG_RANKS[r].name
      });
    }

    for (var c = 0; c < HG_CHANNELS.length; c++) {
      classes.push({
        type_id: "cate:" + HG_CHANNELS[c].slug,
        type_name: HG_CHANNELS[c].name
      });
    }

    return {
      class: classes
    };
  },


  // 首页内容
  homeContent: function (filter) {
    var classes = this.home(filter).class;
    var list = [];

    try {
      list = hgList(
        hgEdge(
          "/api/videos?page=1&size=" + HG_PAGE_SIZE
        )
      );
    } catch (error) {
      // 首页失败不阻塞分类
    }

    return {
      class: classes,
      list: list
    };
  },


  // 分类
  category: function (tid, pg, filter, extend) {
    var typeId = String(
      tid == null ? "latest" : tid
    ).trim() || "latest";

    var page = Math.max(
      1,
      parseInt(pg, 10) || 1
    );

    // 榜单
    if (typeId.indexOf("rank:") === 0) {
      var kind = typeId.slice(5);

      var ranked = hgList(
        hgEdge(
          "/api/ranks/" + encodeURIComponent(kind)
        )
      );

      return {
        list: ranked,
        page: 1,
        pagecount: 1,
        limit: ranked.length,
        total: ranked.length
      };
    }

    var path;

    if (typeId.indexOf("cate:") === 0) {
      path =
        "/api/videos/category/" +
        encodeURIComponent(typeId.slice(5)) +
        "?page=" + page +
        "&size=" + HG_PAGE_SIZE;
    } else {
      path =
        "/api/videos?page=" + page +
        "&size=" + HG_PAGE_SIZE;
    }

    var data = hgEdge(path);
    var list = hgList(data);
    var pager = hgPager(data, page, list.length);

    return {
      list: list,
      page: pager.page,
      pagecount: pager.pagecount,
      limit: pager.limit,
      total: pager.total
    };
  },


  // 搜索
  search: function (wd, quick, page) {
    var keyword = String(wd || "").trim();

    var p = Math.max(
      1,
      parseInt(page, 10) || 1
    );

    if (!keyword) {
      return {
        list: [],
        page: p,
        pagecount: p
      };
    }

    var data = hgEdge(
      "/api/search?q=" +
      encodeURIComponent(keyword) +
      "&page=" + p +
      "&size=" + HG_PAGE_SIZE
    );

    var list = hgList(data);
    var pager = hgPager(data, p, list.length);

    return {
      list: list,
      page: pager.page,
      pagecount: pager.pagecount,
      limit: pager.limit,
      total: pager.total
    };
  },


  // 详情
  detail: function (ids) {
    var id = String(
      Array.isArray(ids) ? ids[0] : (ids || "")
    ).trim();

    if (!id) {
      throw new Error("缺少视频 ID");
    }

    var item = hgEdge(
      "/api/videos/" + encodeURIComponent(id)
    );

    var episodes = (item && item.episodes) || [];
    var rows = [];

    for (var i = 0; i < episodes.length; i++) {
      var ep = episodes[i];

      if (!ep) continue;

      var num = parseInt(ep.ep_num, 10);

      if (!num) continue;

      var label = String(ep.title || "").trim();

      if (!label || label.length > 24) {
        label = "第 " + num + " 集";
      }

      rows.push(
        label + "$" + id + "|ep:" + num
      );
    }

    if (!rows.length) {
      var count = parseInt(
        (item && item.episode_count) || 0,
        10
      );

      for (var n = 1; n <= count; n++) {
        rows.push(
          "第 " + n + " 集$" + id + "|ep:" + n
        );
      }
    }

    if (!rows.length) {
      rows.push("正片$" + id + "|ep:1");
    }

    var info = [];

    if (item && item.description) {
      info.push(String(item.description).trim());
    }

    if (item && item.tags && item.tags.length) {
      info.push("标签：" + item.tags.join(" / "));
    }

    if (item && item.author && item.author.name) {
      info.push("作者：" + item.author.name);
    }

    if (item && item.episode_count) {
      info.push("集数：" + item.episode_count);
    }

    var vod = {
      vod_id: id,

      vod_name:
        String((item && item.title) || "").trim() ||
        ("黄果短剧 " + id),

      vod_pic: hgPic(hgCover(item)),

      vod_content: info.join("\n"),

      vod_play_from: "黄果",

      vod_play_url: rows.join("#")
    };

    return {
      list: [vod]
    };
  },


  // ==================== 播放 ====================

  play: function (flag, id) {
    var raw = String(id || "").trim();

    if (!raw) {
      throw new Error("缺少播放参数");
    }

    // 直链直接放行
    if (/^https?:\/\//i.test(raw)) {
      return {
        parse: 0,
        url: raw,
        header: {
          "User-Agent": HG_UA,
          "Referer": HG_SITE + "/"
        }
      };
    }

    var vodId = raw;
    var ep = 1;

    var at = raw.indexOf("|ep:");

    if (at >= 0) {
      vodId = raw.slice(0, at);
      ep = parseInt(raw.slice(at + 4), 10) || 1;
    } else if (raw.indexOf("ep:") === 0) {
      throw new Error("缺少视频 ID");
    }

    // 优先新版 POST 播放接口
    var primaryError = "";
    var data = null;

    try {
      data = hgEdge(
        "/api/videos/" +
        encodeURIComponent(vodId) +
        "/episodes/" +
        ep +
        "/playback",
        "POST",
        "e30=",
        "application/json"
      );
    } catch (error) {
      primaryError = String(
        error && error.message ? error.message : error
      );
    }

    var url = hgPickPlayUrl(data);

    // 新版失败，回退旧版 GET 接口
    if (!url) {
      try {
        var legacy = hgEdge(
          "/api/videos/" +
          encodeURIComponent(vodId) +
          "/play?ep=" +
          ep +
          "&page_texts=0"
        );

        var legacyUrl = hgPickPlayUrl(legacy);

        if (legacyUrl) {
          data = legacy;
          url = legacyUrl;
        }
      } catch (legacyError) {
        var legacyMessage = String(
          legacyError && legacyError.message
            ? legacyError.message
            : legacyError
        );

        throw new Error(
          "新版和旧版播放接口均失败（第 " +
          ep +
          " 集）；新版：" +
          (primaryError || "未返回播放地址") +
          "；旧版：" +
          legacyMessage
        );
      }
    }

    if (!url) {
      var returned = "";

      try {
        returned = JSON.stringify(data);
      } catch (e) {
        returned = String(data);
      }

      throw new Error(
        "播放接口没有返回可用地址（第 " +
        ep +
        " 集）；" +
        (primaryError
          ? "新版接口错误：" + primaryError + "；"
          : "") +
        "返回结构：" +
        String(returned || "null").slice(0, 500)
      );
    }

    return {
      parse: 0,
      url: url,
      header: {
        "User-Agent": HG_UA,
        "Referer": HG_SITE + "/"
      }
    };
  }
};

export default SPIDER;
