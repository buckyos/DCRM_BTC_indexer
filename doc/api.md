1. 获取铭文信息：

    /inscription/:hash

    GET

    参数：

    hash：铭文hash

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",         // 如果err == 0，没有msg字段
        result: {               // 如果err != 0，没有result字段
            hash,               // 公共数据hash
            address,            // 铭文owner
            block_height,       // 创建区块高度
            timestamp,          // 创建时间
            text,               // 创建时写入的text
            price,              // 当前共鸣价格
            resonance_count     // 当前共鸣次数
        }
    }
    ```

2. 获取某地址拥有的铭文：

    /inscription_by_address/:address/:length?/:offset?/:order?

    GET

    参数

    address：地址

    length: 返回的列表的长度限制，0表示不限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

3. 获取区块范围内的新增的铭文 [begin, end)：

    /inscription_by_block/:begin_block/:end_block?/:length?/:offset?/:order?

    GET

    参数

    begin_block：起始区块

    end_block: 结束区块，0表示一直获取到最新的，默认为0

    length: 返回的列表的长度限制，0表示不限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

4. 获取铭文总数：

    /inscription_count

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: count
    }
    ```

5. 获取某数据的共鸣记录：

    /resonance_by_hash/:hash/:length?/:offset?/:order?

    GET

    参数

    hash： 数据hash

    length: 返回的列表的长度限制，0表示不限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    hash,               // 数据hash
                    inscription_id,     // 铭文id
                    address,            // 共鸣地址
                    block_height,       // 共鸣区块
                    amount              // 共鸣价格
                }
            ]
        }
    }
    ```

6. 获取某地址的共鸣记录：

    /resonance_by_address/:address/:length?/:offset?/:order?

    GET

    参数

    address: 地址

    length: 返回的列表的长度限制，0表示不限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

7. 获取某数据的吟唱记录：

    /chant_by_hash/:hash/:length?/:offset?/:order?

    GET

    参数

    hash: 数据hash

    length: 返回的列表的长度限制，0表示不限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    hash,               // 数据hash
                    inscription_id,     // 铭文id
                    address,            // 吟唱地址
                    block_height,       // 吟唱区块
                    amount              // 
                }
            ]
        }
    }
    ```

8. 获取某数据的吟唱记录：

    /chant_by_address/:address/:length?/:offset?/:order?

    GET

    参数

    address: 地址

    length: 返回的列表的长度限制，0表示不限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

9. 获取某地址的mint记录：

    /mint_record_by_address/:address/:length?/:offset?/:order?

    GET

    参数

    address: 地址

    length: 返回的列表的长度限制，0表示不限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list: [
                {
                    inscription_id,     // mint id
                    block_height,       // mint区块
                    timestamp,          // 时间
                    address,            // mint地址
                    amount,             // mint金额
                    lucky               // 幸运字串
                }
            ]
        }
    }
    ```

10. 获取幸运铭刻列表：

    /luck_mint/:length?/:offset?/:order?

    GET

    参数

    length: 返回的列表的长度限制，0表示不限制，默认为0

    offset: 返回的起始位置，默认为0

    order：desc - 按时间降序（默认）； asc - 按时间升序

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: {
            count,              // 总数
            list                // 列表，item数据格式同上
        }
    }
    ```

11. 获取过去24小时mint总量：

    /mint_last_24

    GET

    返回：

    ```json
    {
        err: 0,
        msg: "错误信息",
        result: totalAmount
    }
    ```