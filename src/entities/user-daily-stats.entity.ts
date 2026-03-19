import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'user_daily_stats' })
@Unique(['userId', 'statDate'])
export class UserDailyStatsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'date' })
  statDate!: string;

  @Column({ type: 'int', default: 0 })
  focusSessions!: number;

  @Column({ type: 'int', default: 0 })
  focusSeconds!: number;

  @Column({ type: 'int', default: 0 })
  breakSeconds!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
