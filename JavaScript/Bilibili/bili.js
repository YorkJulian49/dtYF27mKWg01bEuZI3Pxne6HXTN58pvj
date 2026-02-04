let obj = JSON.parse($response.body);
let url = $request.url;

// 1 tracker
if (url.includes("/x/pd-proxy/tracker")) {
  obj.data = [["stun.chat.bilibili.com:3478"]];
}

// 2 splash
if (url.includes("/x/v2/splash")) {
  if (obj.data) {
    if (obj.data.show) obj.data.show = [];
    if (obj.data.event_list) obj.data.event_list = [];
  }
}

// 3 tab (外部 jq 脚本逻辑等价为空数组)
if (url.includes("/x/resource/show/tab/v2")) {
  if (obj.data?.tab) obj.data.tab = [];
}

// 4 feed index
if (url.includes("/x/v2/feed/index?")) {
  if (obj.data?.items) {
    obj.data.items = obj.data.items.filter(i =>
      i.banner_item == null &&
      i.ad_info == null &&
      i.card_goto === "av" &&
      ["small_cover_v2","large_cover_single_v9","large_cover_v1"].includes(i.card_type)
    );
  }
}

// 5 season
if (url.includes("/pgc/view/v2/app/season")) {
  if (obj.data?.payment) delete obj.data.payment;
}

// 6 story
if (url.includes("/feed/index/story")) {
  if (obj.data?.items) {
    obj.data.items = obj.data.items
      .filter(i =>
        i.ad_info == null &&
        !["vertical_ad_av","vertical_ad_live","vertical_ad_picture"].includes(i.card_goto)
      )
      .map(i => {
        delete i.story_cart_icon;
        delete i.free_flow_toast;
        delete i.image_infos;
        delete i.course_info;
        delete i.game_info;
        return i;
      });
  }
}

// 7 live
if (url.includes("/xlive/")) {
  if (obj.data) {
    delete obj.data.play_together_info;
    delete obj.data.play_together_info_v2;
    delete obj.data.activity_banner_info;

    if (obj.data.function_card)
      obj.data.function_card = obj.data.function_card.map(()=>null);

    if (obj.data.new_tab_info?.outer_list)
      obj.data.new_tab_info.outer_list =
        obj.data.new_tab_info.outer_list.filter(i=>i.biz_id!=33);

    if (obj.data.card_list)
      obj.data.card_list =
        obj.data.card_list.filter(i =>
          !["banner_v2","activity_card_v1"].includes(i.card_type)
        );
  }
}

// 8 skin
if (url.includes("/x/resource/show/skin")) {
  if (obj.data?.common_equip) delete obj.data.common_equip;
}

// 9 mine (外部 jq 逻辑等价删除广告区)
if (url.includes("/x/v2/account/mine")) {
  if (obj.data?.sections)
    obj.data.sections =
      obj.data.sections.filter(i=>!i.ad_extra);
}

// 10 myinfo vip
if (url.includes("/x/v2/account/myinfo")) {
  if (obj.data?.vip && obj.data.vip.status==0) {
    obj.data.vip.status=1;
    obj.data.vip.type=2;
    obj.data.vip.due_date=9005270400000;
    obj.data.vip.role=15;
  }
}

$done({body:JSON.stringify(obj)});
