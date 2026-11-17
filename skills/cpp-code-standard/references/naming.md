# 命名

## 风格选择

底层业务无关公共库和 C 代码采用纯小写风格，单词以下划线分隔；业务模块采用驼峰风格。同一模块不得混用两种风格。修改已有模块时保持其命名风格；已有混用时，本次修改采用一致的命名族。

| 对象 | 纯小写风格 | 驼峰风格 |
|---|---|---|
| 普通变量 | `table_name` | `tableName` |
| 成员变量 | `m_table_name` | `m_tableName` |
| 普通类 | `device_server` | `DeviceServer` |
| 接口类 | `idevice_listener` | `iDeviceListener`、`IDeviceListener` |
| 结构体类型 | `device_state_t` | `TDeviceState` |
| 枚举类型 | `device_quality_e` | `EDeviceQuality` |
| 函数 | `create_request()` | `createRequest()` |

- 驼峰风格中，普通类、结构体和枚举类型使用大驼峰，变量和函数使用小驼峰。
- 成员变量使用 `m_` 前缀。
- 函数采用动宾结构；上下文已明确对象时可使用 `start()`、`stop()`。
- 使用正确且有意义的单词。业务前缀按模块职责选择；结构体的 `_t` / `T` 和枚举的 `_e` / `E` 按模块约定使用，不强加给所有类型别名。

## 文件与目录

文件名、目录名全部小写，可用下划线分词；特殊语义词使用中划线。

- 目录：`utils`、`device_cache`。
- 文件：`device_cache.cpp`、`build_network-client.sh`。
- 程序：`device-watchdog`、`message-bus`。

## 命名空间与常量

- 命名空间全部小写，一般与模块名相同，如 `cache`。
- 禁止 `using namespace ...;` 整段导入命名空间；使用 `std::` 或对应 SDK 的限定名，保留现有函数和类型的作用域。
- 宏和枚举值全部大写，单词以下划线分隔，如 `MAX_NAME_SIZE`、`PROC_STATUS_STARTED`。
- 枚举类型与枚举值分别命名：`EDeviceQuality` 是类型，`QUALITY_GOOD` 是枚举值。
