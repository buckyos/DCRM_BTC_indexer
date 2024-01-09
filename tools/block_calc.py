from datetime import datetime

# the known block height and date time
known_block_height = 18918830
known_date_time_str = '2024-01-02 17:35:42'
known_date_time = datetime.strptime(known_date_time_str, '%Y-%m-%d %H:%M:%S')

# the target date time thw user want to know the block height
target_date_time_str = '2023-12-19 13:38:00'
target_date_time = datetime.strptime(target_date_time_str, '%Y-%m-%d %H:%M:%S')

# calculate the time difference in seconds
time_difference = known_date_time - target_date_time
total_seconds = time_difference.total_seconds()

# calculate the block difference
block_difference = total_seconds / 12  # 12 seconds per block

# calculate the target block height
target_block_height = known_block_height - block_difference

print(f"Target block height: {target_block_height}")