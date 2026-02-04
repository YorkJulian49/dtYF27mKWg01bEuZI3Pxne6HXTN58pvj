// Bilibili 去广告统一处理脚本
// 适用于 Shadowrocket

const url = $request.url;
let body = $response.body;

try {
    let obj = JSON.parse(body);
    
    // 1. tracker 处理
    if (url.includes('/x/pd-proxy/tracker')) {
        if (obj.data && Array.isArray(obj.data)) {
            obj.data = obj.data.map(arr => 
                Array.isArray(arr) ? arr.map(() => "stun.chat.bilibili.com:3478") : arr
            );
        }
    }
    
    // 2. splash 开屏广告处理
    else if (url.includes('/x/v2/splash/')) {
        if (obj.data) {
            obj.data.show = [];
            obj.data.event_list = [];
        }
    }
    
    // 3. tab 页面处理
    else if (url.includes('/x/resource/show/tab/v2')) {
        if (obj.data && obj.data.tab) {
            obj.data.tab = obj.data.tab.filter(item => {
                const allowedIds = [39, 40, 41, 545, 151];
                return allowedIds.includes(item.id);
            });
        }
        if (obj.data) {
            delete obj.data.top;
            delete obj.data.bottom;
        }
    }
    
    // 4. feed 推荐流处理
    else if (url.includes('/x/v2/feed/index') && !url.includes('story')) {
        if (obj.data && obj.data.items) {
            obj.data.items = obj.data.items.filter(item => {
                const validCardTypes = ['small_cover_v2', 'large_cover_single_v9', 'large_cover_v1'];
                return !item.banner_item && 
                       !item.ad_info && 
                       item.card_goto === 'av' && 
                       validCardTypes.includes(item.card_type);
            });
        }
    }
    
    // 5. season 番剧页面处理
    else if (url.includes('/pgc/view/v2/app/season')) {
        if (obj.data) {
            delete obj.data.payment;
        }
    }
    
    // 6. story 竖屏视频处理
    else if (url.includes('/x/v2/feed/index/story')) {
        if (obj.data && obj.data.items) {
            const adCardGoto = ['vertical_ad_av', 'vertical_ad_live', 'vertical_ad_picture'];
            obj.data.items = obj.data.items.filter(item => {
                return !item.ad_info && !adCardGoto.includes(item.card_goto);
            }).map(item => {
                delete item.story_cart_icon;
                delete item.free_flow_toast;
                delete item.image_infos;
                delete item.course_info;
                delete item.game_info;
                return item;
            });
        }
    }
    
    // 7. live 直播处理
    else if (url.includes('/xlive/')) {
        if (obj.data) {
            delete obj.data.play_together_info;
            delete obj.data.play_together_info_v2;
            delete obj.data.activity_banner_info;
            
            if (obj.data.function_card) {
                obj.data.function_card = obj.data.function_card.map(() => null);
            }
            
            if (obj.data.new_tab_info && obj.data.new_tab_info.outer_list) {
                obj.data.new_tab_info.outer_list = obj.data.new_tab_info.outer_list.filter(
                    item => item.biz_id !== 33
                );
            }
            
            if (obj.data.card_list) {
                const excludeCardTypes = ['banner_v2', 'activity_card_v1'];
                obj.data.card_list = obj.data.card_list.filter(
                    item => !excludeCardTypes.includes(item.card_type)
                );
            }
            
            if (obj.data.show_reserve_status !== undefined) {
                obj.data.show_reserve_status = false;
            }
            if (obj.data.reserve_info && obj.data.reserve_info.show_reserve_status !== undefined) {
                obj.data.reserve_info.show_reserve_status = false;
            }
            if (obj.data.shopping_info && obj.data.shopping_info.is_show !== undefined) {
                obj.data.shopping_info.is_show = 0;
            }
        }
    }
    
    // 8. mine 我的页面处理
    else if (url.includes('/x/v2/account/mine')) {
        if (obj.data) {
            // 移除推广模块
            delete obj.data.vip_section;
            delete obj.data.vip_section_v2;
            delete obj.data.answer;
            
            // 处理sections_v2
            if (obj.data.sections_v2) {
                obj.data.sections_v2 = obj.data.sections_v2.filter(section => {
                    const excludeTitles = ['创作推广', '更多服务'];
                    return !excludeTitles.includes(section.title);
                }).map(section => {
                    if (section.items) {
                        section.items = section.items.filter(item => {
                            const excludeIds = [396, 397, 398, 399, 407];
                            return !excludeIds.includes(item.id);
                        });
                    }
                    return section;
                });
            }
        }
    }
    
    // 9. myinfo 个人信息处理 (VIP伪装)
    else if (url.includes('/x/v2/account/myinfo')) {
        if (obj.data && obj.data.vip) {
            if (obj.data.vip.status === 0) {
                obj.data.vip = {
                    ...obj.data.vip,
                    status: 1,
                    type: 2,
                    due_date: 9005270400000,
                    role: 15
                };
            }
        }
    }
    
    // 10. skin 皮肤处理
    else if (url.includes('/x/resource/show/skin')) {
        if (obj.data) {
            delete obj.data.common_equip;
        }
    }
    
    body = JSON.stringify(obj);
} catch (e) {
    console.log('Bilibili Script Error: ' + e);
}

$done({ body });
