/**
 * zib支付JS
 */

(function ($) {
    var _win = window._win;
    var _body = $("body");
    var _modal = false;
    var is_verify = false;
    var order_result = {};
    var pay_inputs = {};
    var pay_ajax_url = _win.ajax_url;
    var modal_id = 'zibpay_modal';

    init();

    function init() {
        var _modal_html = '<div class="modal fade flex jc" style="display:none;" id="' + modal_id + '" tabindex="-1" role="dialog" aria-hidden="false">\
        <div class="modal-dialog" role="document">\
            <div class="pay-payment alipay">\
                <div class="modal-body modal-pay-body">\
                    <div class="row-5 hide-sm">\
                        <img class="lazyload pay-sys t-wechat" alt="alipay" src="" data-src="' + _win.uri + '/zibpay/assets/img/alipay-sys.png">\
                        <img class="lazyload pay-sys t-alipay" alt="wechat" src="" data-src="' + _win.uri + '/zibpay/assets/img/wechat-sys.png">\
                    </div>\
                    <div class="row-5">\
                    <div class="pay-qrcon">\
                        <div class="qrcon">\
                            <div class="pay-logo-header mb10"><span class="pay-logo"></span><span class="pay-logo-name t-wechat">支付宝</span><span class="pay-logo-name t-alipay">微信支付</span></div>\
                            <div class="pay-title em09 muted-2-color padding-h6"></div>\
                            <div><span class="em09">￥</span><span class="pay-price em14"></span></div>\
                            <div class="pay-qrcode">\
                                <img src="" alt="pay-qrcode">\
                            </div>\
                        </div>\
                    <div class="pay-switch"></div>\
                    <div class="pay-notice"><div class="notice load">正在生成订单，请稍候</div></div>\
                    </div>\
				</div>\
                </div>\
            </div>\
        </div>\
    </div>';

        $("link#zibpay_css").length || $("head").append('<link type="text/css" id="zibpay_css" rel="stylesheet" href="' + _win.uri + '/zibpay/assets/css/main.css">');
        $("#" + modal_id).length || _body.append(_modal_html);

        $(document).ready(weixin_auto_send);
        _body.on("click", '.initiate-pay', initiate_pay);
        _body.on("click", '.pay-vip', vip_pay);

        //模态框关闭停止查询登录
        _body.on("hide.bs.modal", "#" + modal_id, function () {
            order_result.order_num = false;
            is_verify = false;
        });

        _modal = $('#' + modal_id);
    }

    function ajax_send(data, _this) {
        data.openid && notyf("正在发起支付，请稍等...", "load", "", "pay_ajax"); //微信JSAPI支付

        zib_ajax(_this, data, function (n) {
            //1.遇到错误
            if (n.error) {
                return;
            }

            //2.打开链接
            if (n.url && n.open_url) {
                window.location.href = n.url;
                window.location.reload;
                notyf("正在跳转到支付页面");
                return;
            }

            //3.微信JSAPI支付
            if (n.jsapiParams) {
                var jsapiParams = n.jsapiParams;
                if (typeof WeixinJSBridge == "undefined") {
                    //安卓手机需要挂载
                    if (document.addEventListener) {
                        document.addEventListener('WeixinJSBridgeReady', weixin_bridge_ready(jsapiParams), false);
                    } else if (document.attachEvent) {
                        document.attachEvent('WeixinJSBridgeReady', weixin_bridge_ready(jsapiParams));
                        document.attachEvent('onWeixinJSBridgeReady', weixin_bridge_ready(jsapiParams));
                    }
                } else {
                    weixin_bridge_ready(jsapiParams);
                }
                notyf("请完成支付", "", "", (data.openid ? 'pay_ajax' : ''));
                return;
            }

            //4.扫码支付
            if (n.url_qrcode) {
                _modal.find('.more-html').remove(); //隐藏更多内容
                $(".modal:not(#" + modal_id + ")").modal('hide'); //隐藏其他模态框
                _modal.find('.pay-qrcode img').attr('src', n.url_qrcode); //加载二维码
                qrcode_notice('请扫码支付，支付成功后会自动跳转', '');
                n.more_html && _modal.find('.pay-notice').before('<div class="more-html">' + n.more_html + '</div>');
                n.order_name && _modal.find('.pay-title').html(n.order_name);
                n.order_price && _modal.find('.pay-price').html(n.order_price);
                n.payment_method && _modal.find('.pay-payment').removeClass('wechat alipay').addClass(n.payment_method);

                _modal.modal('show');

                //开始ajax检测是否付费成功
                order_result = n;
                if (!is_verify) {
                    verify_pay();
                    is_verify = true;
                }
            }

        }, 'stop');
    }

    //扫码支付检测是否支付成功
    function verify_pay() {
        if (order_result.order_num) {
            $.ajax({
                type: "POST",
                url: pay_ajax_url,
                data: {
                    "action": "check_pay",
                    "order_num": order_result.order_num,
                },
                dataType: "json",
                success: function (n) {
                    if (n.status == "1") {
                        qrcode_notice('支付成功，页面跳转中', 'success');
                        setTimeout(function () {
                            if ("undefined" != typeof pay_inputs.return_url && pay_inputs.return_url) {
                                window.location.href = delQueStr('openid', delQueStr('zippay', pay_inputs.return_url));
                                window.location.reload;
                            } else {
                                location.href = delQueStr('openid', delQueStr('zippay'));
                                location.reload;
                            }
                        }, 300);
                    } else {
                        setTimeout(function () {
                            verify_pay();
                        }, 2000);
                    }
                }
            });
        }
    }

    function initiate_pay() {
        var _this = $(this);
        var form = _this.parents('form');
        pay_inputs = form.serializeObject();
        pay_inputs.action = 'initiate_pay';
        pay_inputs.return_url || (pay_inputs.return_url = window.location.href);
        ajax_send(pay_inputs, _this);
        return false;
    }

    //扫码支付通知显示
    function qrcode_notice(msg, type) {
        var notice_box = _modal.find('.pay-notice .notice');
        msg = type == 'load' ? '<i class="loading mr6"></i>' + msg : msg;
        notice_box.removeClass('load warning success danger').addClass(type).html(msg);
    }

    //微信JSAPI支付
    function weixin_bridge_ready(jsapiParams) {
        WeixinJSBridge.invoke(
            'getBrandWCPayRequest', jsapiParams,
            function (res) {
                if (res.err_msg == "get_brand_wcpay_request:ok") {
                    // 使用以上方式判断前端返回,微信团队郑重提示：
                    //res.err_msg将在用户支付成功后返回ok，但并不保证它绝对可靠。
                    //支付成功刷新页面
                } else {
                    //取消支付，或者支付失败


                }
                location.href = delQueStr('openid', delQueStr('zippay'));
                location.reload; //刷新页面

            });
    }

    //微信JSAPI支付收到回调之后，再次自动提交
    function weixin_auto_send() {
        var zippay = GetRequest('zippay');
        var openid = GetRequest('openid');
        if (zippay && openid && is_weixin_app()) {
            pay_inputs.pay_type = 'wechat';
            pay_inputs.openid = openid;
            pay_inputs.action = 'initiate_pay';

            ajax_send(pay_inputs, $('<div></div>'))
        }
    }

    //判断是否在微信浏览器内
    function is_weixin_app() {
        var ua = window.navigator.userAgent.toLowerCase();
        return (ua.match(/MicroMessenger/i) == 'micromessenger');
    }

    function vip_pay() {
        var _this = $(this);

        var _modal = '<div class="modal fade flex jc" id="modal_pay_uservip" tabindex="-1" role="dialog" aria-hidden="false">\
    <div class="modal-dialog" role="document">\
    <div class="modal-content">\
    <div class="modal-body"><h4 style="padding:20px;" class="text-center"><i class="loading zts em2x"></i></h4></div>\
    </div>\
    </div>\
    </div>\
    </div>';
        $("#modal_pay_uservip").length || _body.append(_modal);
        var modal = $('#modal_pay_uservip');
        var vip_level = _this.attr('vip-level') || 1;
        if (modal.find('.payvip-modal').length) {
            $('a[href="#tab-payvip-' + vip_level + '"]').tab('show');
            modal.modal('show');
        } else {
            notyf("加载中，请稍等...", "load", "", "payvip_ajax");
            $.ajax({
                type: "POST",
                url: pay_ajax_url,
                data: {
                    "action": "pay_vip",
                    "vip_level": vip_level,
                },
                dataType: "json",
                success: function (n) {
                    var msg = n.msg || '请选择会员选项';
                    if ((msg.indexOf("登录") != -1)) {
                        modal.remove()
                        $('.signin-loader').click();
                    }
                    notyf(msg, (n.ys ? n.ys : (n.error ? 'danger' : "")), 3, "payvip_ajax");
                    n.error || (modal.find('.modal-content').html(n.html), modal.trigger('loaded.bs.modal').modal('show'), auto_fun());
                }
            });
        }
        return !1;
    }
})(jQuery);

function GetRequest(name) {
    var url = window.parent.location.search; //获取url中"?"符后的字串
    // var theRequest = new Object();
    if (url.indexOf("?") != -1) {
        var str = url.substr(1);
        if (str.indexOf("#" != -1)) {
            str = str.substr(0);
        }
        strs = str.split("&");
        for (var i = 0; i < strs.length; i++) {
            if (strs[i].indexOf(name) != -1) {
                return strs[i].split("=")[1];
            }
        }
    }
    return null;
}


//从链接中删除参数
function delQueStr(ref, url) {
    var str = "";
    url = url || window.location.href;
    if (url.indexOf('?') != -1) {
        str = url.substr(url.indexOf('?') + 1);
    } else {
        return url;
    }
    var arr = "";
    var returnurl = "";
    if (str.indexOf('&') != -1) {
        arr = str.split('&');
        for (var i in arr) {
            if (arr[i].split('=')[0] != ref) {
                returnurl = returnurl + arr[i].split('=')[0] + "=" + arr[i].split('=')[1] + "&";
            }
        }
        return url.substr(0, url.indexOf('?')) + "?" + returnurl.substr(0, returnurl.length - 1);
    } else {
        arr = str.split('=');
        if (arr[0] == ref) {
            return url.substr(0, url.indexOf('?'));
        } else {
            return url;
        }
    }
}






/*

function pay_action_ajax(data, _this) {
    // 弹出模态框
    $(".modal:not(#modal_pay)").modal('hide');
    var modal = $('#modal_pay');
    (modal.length && !data.openid) && modal.modal('show').find('.pay-payment').removeClass('wechat alipay').addClass(data.payment_method || 'wechat');
    modal.find('.more-html').remove();
    pay_ajax_notice('正在生成订单，请稍候', 'load');
    modal.length || (notyf("加载中，请稍等...", "load", "", "pay_ajax"), data.get_modal = 1);
    data.openid && notyf("正在发起支付，请稍等...", "load", "", "pay_ajax");

    $.ajax({
        type: "POST",
        url: pay_ajax_url,
        data: data,
        dataType: "json",
        error: function (n) {
            var _msg = "操作失败 " + n.status + ' ' + n.statusText + '，请刷新页面后重试';
            if (n.responseText && n.responseText.indexOf("致命错误") > -1) {
                _msg = '网站遇到致命错误，请检查插件冲突或通过错误日志排除错误';
            }
            notyf(_msg, 'danger', '', 'pay_ajax')
        },
        success: function (n) {
            //console.log(n);
            (n.msg || !modal.length) && notyf((n.msg || '请扫码付款，付款成功后会自动跳转'), (n.ys ? n.ys : (n.error ? 'danger' : "")), '', (modal.length ? '' : 'pay_ajax'));
            modal.length || (_body.append(n.pay_modal), auto_fun(), modal = $('#modal_pay'), modal.modal('show'));
            if (n.error) {
                pay_ajax_notice((n.msg ? n.msg : "处理失败,即将刷新页面"), 'danger');
                setTimeout(function () {
                    //待处理，需要取消注释
                    //  location.href = delQueStr('openid', delQueStr('zippay'));
                    //   location.reload;
                }, 2000);
            } else {
                order_result = n;
                if (!is_verify) {
                    verify_pay();
                    is_verify = !0;
                }
            }

            if (n.jsapiParams) { //微信JSAPI支付
                pay_sapiParams = n.jsapiParams;
                if (typeof WeixinJSBridge == "undefined") {
                    if (document.addEventListener) {
                        document.addEventListener('WeixinJSBridgeReady', WeixinonBridgeReady, false);
                    } else if (document.attachEvent) {
                        document.attachEvent('WeixinJSBridgeReady', WeixinonBridgeReady);
                        document.attachEvent('onWeixinJSBridgeReady', WeixinonBridgeReady);
                    }
                } else {
                    WeixinonBridgeReady();
                }
                notyf("请完成支付", "", "", (data.openid ? 'pay_ajax' : ''));
                return pay_ajax_notice('请完成支付', '');
            }

            n.order_name && modal.find('.pay-title').html(n.order_name);
            n.order_price && modal.find('.pay-price').html(n.order_price);
            n.payment_method && modal.find('.pay-payment').removeClass('wechat alipay').addClass(n.payment_method);

            if (n.more_html && !n.open_url) {
                modal.find('.pay-notice').before('<div class="more-html">' + n.more_html + '</div>');
            }
            if (n.url_qrcode && !n.open_url) {
                qrcode_box = modal.find('.pay-qrcode img');
                qrcode_box.attr('src', n.url_qrcode).css({
                    'filter': 'blur(0)',
                    'opacity': '1',
                    'transition': 'all 0.3s ease 0.5s'
                })
                pay_ajax_notice('请扫码付款，付款成功后会自动跳转', '');
            }
            if (n.url && n.open_url) {
                window.location.href = n.url;
                window.location.reload;
                pay_ajax_notice('正在跳转到支付页面', '');
                return;
            }
            if (!n.url && !n.url_qrcode) {
                pay_ajax_notice((n.msg ? n.msg : "支付配置错误"), 'danger');
            }
        }
    });
}

//微信JSAPI支付
function WeixinonBridgeReady() {
    if (pay_sapiParams) {
        WeixinJSBridge.invoke(
            'getBrandWCPayRequest', pay_sapiParams,
            function (res) {
                if (res.err_msg == "get_brand_wcpay_request:ok") {
                    // 使用以上方式判断前端返回,微信团队郑重提示：
                    //res.err_msg将在用户支付成功后返回ok，但并不保证它绝对可靠。
                }
                location.href = delQueStr('openid', delQueStr('zippay'));
                location.reload; //刷新页面
            });
    }
}

//支付通知显示
function pay_ajax_notice(msg, type) {
    var notice_box = $('#modal_pay').find('.pay-notice .notice');
    msg = type == 'load' ? '<i class="loading mr6"></i>' + msg : msg;
    notice_box.removeClass('load warning success danger').addClass(type).html(msg);
}

//切换付款方式
_body.on("click", '.initiate-pay-switch', function (e) {
    var _this = $(this);
    pay_inputs.pay_type = _this.attr('pay_type');
    pay_action_ajax(pay_inputs, _this);
    _this.parents('.pay-payment').find('.pay-qrcode img').css({
        'filter': 'blur(5px)',
        'opacity': '.8',
        'transition': 'all 0.3s'
    });
    return false;
})

//发起支付
_body.on("click", '.initiate-pay', function (e) {
    var _this = $(this);
    var form = _this.parents('form');
    pay_inputs = form.serializeObject();
    pay_inputs.action = 'initiate_pay';
    pay_inputs.return_url || (pay_inputs.return_url = window.location.href);
    pay_action_ajax(pay_inputs, _this);
    return !1;
})

//模态框关闭停止查询登录
_body.on("hide.bs.modal", "#modal_pay", function () {
    order_result.order_num = false;
    is_verify = false;
});

function verify_pay() {
    if (order_result.order_num) {
        $.ajax({
            type: "POST",
            url: pay_ajax_url,
            data: {
                "action": "check_pay",
                "post_id": pay_inputs.post_id,
                "order_num": order_result.order_num,
            },
            dataType: "json",
            success: function (n) {
                if (n.status == "1") {
                    pay_ajax_notice('付款成功，页面跳转中', 'success');
                    setTimeout(function () {
                        if ("undefined" != typeof pay_inputs.return_url && pay_inputs.return_url) {
                            window.location.href = delQueStr('openid', delQueStr('zippay', pay_inputs.return_url));
                            window.location.reload;
                        } else {
                            location.href = delQueStr('openid', delQueStr('zippay'));
                            location.reload;
                        }
                    }, 500);
                } else {
                    setTimeout(function () {
                        verify_pay();
                    }, 2000);
                }
            }
        });
    }
}

//购买会员
_body.on("click", '.pay-vip', function (e) {
    var _this = $(this);

    var _modal = '<div class="modal fade flex jc" id="modal_pay_uservip" tabindex="-1" role="dialog" aria-hidden="false">\
    <div class="modal-dialog" role="document">\
    <div class="modal-content">\
    <div class="modal-body"><h4 style="padding:20px;" class="text-center"><i class="loading zts em2x"></i></h4></div>\
    </div>\
    </div>\
    </div>\
    </div>';
    $("#modal_pay_uservip").length || _body.append(_modal);
    auto_fun();
    var modal = $('#modal_pay_uservip');
    var vip_level = _this.attr('vip-level') || 1;
    if (modal.find('.payvip-modal').length) {
        $('a[href="#tab-payvip-' + vip_level + '"]').tab('show');
        modal.modal('show');
    } else {
        notyf("加载中，请稍等...", "load", "", "payvip_ajax");
        $.ajax({
            type: "POST",
            url: pay_ajax_url,
            data: {
                "action": "pay_vip",
                "vip_level": vip_level,
            },
            dataType: "json",
            success: function (n) {
                // console.log(n);
                var msg = n.msg || '请选择会员选项';
                if ((msg.indexOf("登录") != -1)) {
                    modal.remove()
                    $('.signin-loader').click();
                }
                notyf(msg, (n.ys ? n.ys : (n.error ? 'danger' : "")), 3, "payvip_ajax");
                n.error || (modal.find('.modal-content').html(n.html), modal.modal('show'));
            }
        });
    }
    return !1;
})

//微信JSAPI跳转支付
function isWeiXinApp() {
    var ua = window.navigator.userAgent.toLowerCase();
    return (ua.match(/MicroMessenger/i) == 'micromessenger');
}


$(document).ready(function () {
    var zippay = GetRequest('zippay');
    var openid = GetRequest('openid');
    if (zippay && openid && isWeiXinApp()) {
        var pay_inputs = {};
        pay_inputs.pay_type = zippay;
        pay_inputs.openid = openid;
        pay_inputs.action = 'initiate_pay';

        pay_action_ajax(pay_inputs)
    }
})

*/