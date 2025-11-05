# -*- coding: utf-8 -*-
"""
温馨小贴士 - 心灵守护者 (Heart Guardian)

这个程序会在屏幕上弹出多个温馨提示窗口，
提供各种温暖人心的小贴士，
给你带来好心情和正能量。

按 ESC 键可一键关闭所有窗口并退出程序，
按 BackSpace 键可关闭当前窗口。
"""
import tkinter as tk
import random
import threading
import time
import queue
import requests
import json

# 全局变量：存储所有窗口、控制程序运行状态
all_windows = []  # 存储所有弹出的提示窗口
running = True    # 控制是否继续创建窗口
thread_stop = False  # 控制窗口是否停止
window_queue = queue.Queue()  # 用于在主线程中创建窗口的队列
window_count = 0  # 已创建的窗口计数
# 将在初始化时设置MAX_WINDOWS

# 默认配置（作为兜底使用）
DEFAULT_MAX_WINDOWS = 100  # 默认最大窗口数量
DEFAULT_TIPS = [
    '多喝水哦~', '保持微笑呀', '每天都要元气满满',
    '记得吃水果', '保持好心情', '好好爱自己',
    '梦想成真', '顺顺利利', '早点休息', '别熬夜',
    '天冷加衣', '今天也要开心', '烦恼退退退','爱你～'
]
DEFAULT_BG_COLORS = [
    'lightpink', 'skyblue', 'lightgreen', 'lightyellow',
    'plum', 'coral', 'bisque', 'mistyrose', 'honeydew'
]

def get_config_from_api():
    """
    从网络接口获取配置信息
    返回解析后的tips、bg_colors列表和max_windows值，如果请求失败则返回默认值
    """
    config_url = "https://qiji.host/api/v1/auth/app_config"
    tips_list = DEFAULT_TIPS.copy()
    bg_colors_list = DEFAULT_BG_COLORS.copy()
    max_windows_val = DEFAULT_MAX_WINDOWS

    try:
        print("正在从网络获取配置...")
        # 发送请求，设置超时时间为5秒
        response = requests.get(config_url, timeout=5)

        # 检查响应状态码
        if response.status_code == 200:
            data = response.json()
            # 检查响应结构是否正确
            if data.get("code") == 0 and "data" in data:
                common_config = data["data"].get("common_config", {})

                # 解析tips
                if "tips" in common_config:
                    print("tips 字段存在", common_config["tips"])
                    try:
                        tips_str = common_config["tips"]
                        # 确保是字符串类型再进行JSON解析
                        if isinstance(tips_str, str):
                            parsed_tips = json.loads(tips_str)
                            if isinstance(parsed_tips, list):
                                tips_list = parsed_tips
                                print(f"成功获取到 {len(tips_list)} 条提示语")
                    except (json.JSONDecodeError, TypeError):
                        print("提示语解析失败，使用默认值")

                # 解析bg_colors
                if "bg_colors" in common_config:
                    try:
                        bg_colors_str = common_config["bg_colors"]
                        # 确保是字符串类型再进行JSON解析
                        if isinstance(bg_colors_str, str):
                            parsed_colors = json.loads(bg_colors_str)
                            if isinstance(parsed_colors, list):
                                bg_colors_list = parsed_colors
                                print(f"成功获取到 {len(bg_colors_list)} 种背景色")
                    except (json.JSONDecodeError, TypeError):
                        print("背景色解析失败，使用默认值")

                # 解析max_windows
                if "max_windows" in common_config:
                    try:
                        max_windows_str = common_config["max_windows"]
                        # 确保是字符串类型再转换为整数
                        if isinstance(max_windows_str, str):
                            max_windows_val = int(max_windows_str)
                            # 确保值为正整数
                            if max_windows_val <= 0:
                                print("max_windows值无效，使用默认值")
                                max_windows_val = DEFAULT_MAX_WINDOWS
                            else:
                                print(f"成功获取到最大窗口数: {max_windows_val}")
                    except (ValueError, TypeError):
                        print("max_windows解析失败，使用默认值")
        else:
            print(f"请求失败，状态码: {response.status_code}，使用默认配置")
    except Exception as e:
        print(f"获取配置时发生错误: {e}，使用默认配置")

    return tips_list, bg_colors_list, max_windows_val

# 初始化时从API获取配置
tips, bg_colors, MAX_WINDOWS = get_config_from_api()

def create_warm_tip_window(root):
    """在主线程中创建单个温馨提示窗口"""
    if not running:
        return

    try:
        # 使用Toplevel而不是Tk，避免多主窗口问题
        window = tk.Toplevel(root)
        all_windows.append(window)

        # 窗口基础配置：随机位置、固定大小、置顶显示
        screen_width = root.winfo_screenwidth()
        screen_height = root.winfo_screenheight()
        window_width = 250
        window_height = 60

        # 随机生成窗口位置（确保窗口完全显示在屏幕内）
        x = random.randrange(0, screen_width - window_width)
        y = random.randrange(0, screen_height - window_height)
        window.title('')
        window.geometry(f"{window_width}x{window_height}+{x}+{y}")
        window.attributes('-topmost', True)  # 窗口始终置顶

        # 随机选择提示语和背景色
        tip = random.choice(tips)
        bg_color = random.choice(bg_colors)

        # 创建提示文字标签
        tk.Label(
            window,
            text=tip,
            bg=bg_color,
            font=('微软雅黑', 16),
            width=30,
            height=3
        ).pack()

        # 单个窗口按BackSpace键可关闭自身
        window.bind('<BackSpace>', lambda e: window.destroy())
        # 单个窗口按ESC键关闭所有窗口并退出程序
        window.bind('<Escape>', lambda e: close_all_windows())

        # 窗口关闭时从列表中移除
        def on_window_close():
            if window in all_windows:
                all_windows.remove(window)

        window.protocol("WM_DELETE_WINDOW", on_window_close)

        # 定期检查线程停止标志
        def check_stop_signal():
            if thread_stop:
                try:
                    window.destroy()
                except:
                    pass
                return
            # 每100毫秒检查一次
            window.after(100, check_stop_signal)

        check_stop_signal()

    except Exception as e:
        print(f"创建窗口时出错: {e}")

def close_all_windows():
    """一键关闭所有窗口和终止程序"""
    global running, thread_stop
    running = False       # 停止创建新窗口
    thread_stop = True    # 通知所有窗口停止运行
    print('收到ESC键，正在关闭所有窗口...')

    # 遍历所有窗口，强制销毁
    for win in all_windows[:]:  # 创建副本避免遍历中修改列表
        try:
            win.destroy()
        except Exception as e:
            print(f"关闭窗口时出错: {e}")

    # 清空窗口列表
    all_windows.clear()

    print('所有窗口已关闭')

    # 退出主事件循环，确保程序能够正常退出
    root.quit()  # 全局root变量将在main中定义

def window_creation_task():
    """窗口创建任务线程，将创建请求放入队列"""
    global window_count
    try:
        # 创建指定数量的窗口请求
        while window_count < MAX_WINDOWS and running:
            window_queue.put(1)  # 放入任意值，表示需要创建一个窗口
            window_count += 1
            time.sleep(0.1)  # 控制窗口弹出速度
        print('所有窗口创建任务已完成')
    except Exception as e:
        print(f"窗口创建任务线程出错: {e}")

def process_window_queue(root):
    """在主线程中处理窗口创建队列"""
    if not running:
        root.quit()  # 退出主事件循环
        return

    try:
        # 尝试创建一个窗口
        if not window_queue.empty():
            window_queue.get_nowait()
            create_warm_tip_window(root)
            window_queue.task_done()
    except queue.Empty:
        pass
    except Exception as e:
        print(f"处理窗口队列时出错: {e}")

    # 继续检查队列
    root.after(10, process_window_queue, root)

if __name__ == "__main__":
    global root  # 声明为全局变量，以便close_all_windows函数可以访问
    # 在主线程中创建根窗口
    root = tk.Tk()
    root.withdraw()  # 隐藏主窗口

    # 绑定ESC键到主窗口
    root.bind('<Escape>', lambda e: close_all_windows())

    # 启动窗口创建任务线程
    creator_thread = threading.Thread(target=window_creation_task)
    creator_thread.daemon = True  # 设为守护线程
    creator_thread.start()

    # 开始处理窗口创建队列
    process_window_queue(root)

    # 启动主事件循环
    try:
        root.mainloop()
    except KeyboardInterrupt:
        print("程序被用户中断")
    finally:
        # 确保清理所有资源
        close_all_windows()
        print("程序正常退出")
