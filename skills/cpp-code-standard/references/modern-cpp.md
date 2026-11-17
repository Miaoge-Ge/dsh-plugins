# 现代 C++ 规则（C++17/20/23）

命名、排版、注释与类型见本技能其余规则；本文补充资源管理、异常安全与现代 C++ 用法。

## 关键规则

- 内存安全：不要用裸指针管理资源，使用智能指针（`std::unique_ptr`/`std::shared_ptr`）或标准容器。
- RAII：构造函数获取资源、析构函数释放；不抛异常的构造函数标记 `noexcept`。
- 现代特性：优先 `auto`、范围 `for`、`constexpr`、`nullptr`；指针不要用 `NULL` 或 `0`。
- 异常安全：明确异常保证（`noexcept` 或文档化）；析构函数必须 `noexcept`。
- 类型安全：禁止 C 风格转换，使用 `static_cast`/`dynamic_cast`；避免 `reinterpret_cast`。
- 模板约束：用 `concept`（C++20）或 `static_assert` 约束模板参数，给出清晰的编译错误。
- 性能：优先移动语义与完美转发；避免不必要拷贝；热路径避免虚调用。
- 编译安全：每个头文件使用 `#pragma once` 或包含保护；优先前向声明而不是 `#include`。
- 零容忍裸 `new`/`delete`：使用 `std::make_unique` / `std::make_shared`。
- 数组用 `std::vector` 或 `std::array`，不用 C 风格数组；字符串用 `std::string`，不用裸 `char*` 操作。
- 锁用 `std::lock_guard` 或 `std::unique_lock`，不要裸 `mutex.lock()`。

## 代码组织

- 头文件只暴露接口，实现放在 `.cpp`（模板类除外）。
- 单一职责：类公开方法约 5 个以内，函数约 30 行以内（简单转发的除外）。
- 包含顺序：对应头文件 → C 库 → C++ 库 → 第三方 → 项目头文件，组间空行。
- 禁止 `using namespace std;`，改用 `using std::string` 这类定向引入。

## 示例

正确：RAII、智能指针、异常安全。

```cpp
class FileProcessor {
public:
    explicit FileProcessor(std::string_view path)
        : file_(std::fopen(path.data(), "r")) {
        if (!file_) {
            throw std::runtime_error("Failed to open file: " + std::string(path));
        }
    }

    FileProcessor(const FileProcessor&) = delete;
    FileProcessor& operator=(const FileProcessor&) = delete;

    FileProcessor(FileProcessor&& other) noexcept
        : file_(std::exchange(other.file_, nullptr)) {}

    ~FileProcessor() noexcept {
        if (file_) std::fclose(file_);
    }

    std::string read_all() {
        std::string content;
        constexpr size_t buffer_size = 4096;
        std::vector<char> buffer(buffer_size);

        while (std::fgets(buffer.data(), buffer.size(), file_)) {
            content.append(buffer.data());
        }
        return content;
    }

private:
    std::FILE* file_;
};
```

错误：裸指针、内存泄漏、非异常安全。

```cpp
class BadProcessor {
public:
    BadProcessor(const char* path) {
        file = fopen(path, "r");   // 可能失败且未检查
        buffer = new char[1024];    // 裸 new
    }

    ~BadProcessor() {
        fclose(file);
        delete[] buffer;            // 构造函数抛异常时泄漏
    }

    char* read() {
        fgets(buffer, 1024, file);
        return buffer;              // 悬垂指针风险
    }

private:
    FILE* file;
    char* buffer;
};
```
